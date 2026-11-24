import type { Group, Person } from "../types";
import type { AccountRow } from "./accountOverview";
import { loginIdOf, loginsOf } from "./logins";

// The requests for a sign-in link on Min side, as the Innlogging tab lists them: who asked and has
// not signed in afterwards, and which addresses that are not in the register asked. The requests are
// written by the installation's function (server/signInEmail.ts) and read here; nothing is stored.

/** What became of a request: the e-mail was sent, the limit on requests stopped it, or the e-mail service failed. */
export type LoginRequestResult = "sent" | "failed" | "limited";

/** One request as it is written in the log. The address is in lower case. */
export interface LoginRequest {
  email: string;
  /** ISO time. */
  at: string;
  inRegister: boolean;
  result: LoginRequestResult;
}

/** A person in the register who was sent a link, and has not signed in since. */
export interface AskedRow {
  person: Person;
  address: string;
  /** ISO time of the latest request that was sent. */
  latest: string;
  /** Requests in the period, of any result. */
  count: number;
  isLeader: boolean;
}

/** An address that is not in the register, and asked for a link. */
export interface StrangerRow {
  address: string;
  /** ISO time of the latest request, of any result. */
  latest: string;
  count: number;
}

export interface RequestTotals {
  requests: number;
  sent: number;
  limited: number;
  failed: number;
}

export interface RequestOverview {
  /** Leaders first, then by name. */
  askedNotSignedIn: AskedRow[];
  /** Newest request first. */
  askedNotInRegister: StrangerRow[];
  totals: RequestTotals;
}

/** The counts of the requests: how many, and what became of them. */
export function requestTotalsOf(requests: readonly LoginRequest[]): RequestTotals {
  return {
    requests: requests.length,
    sent: requests.filter((request) => request.result === "sent").length,
    limited: requests.filter((request) => request.result === "limited").length,
    failed: requests.filter((request) => request.result === "failed").length,
  };
}

const time = (iso: string): number => Date.parse(iso);

/**
 * The two lists of the Innlogging tab. Someone is in the first list when their latest request that
 * was sent is not followed by a sign-in: no account with their address has signed in later than that
 * request. Requests that were limited or failed do not count as a link sent.
 */
export function requestOverviewOf(requests: readonly LoginRequest[], persons: readonly Person[], accounts: readonly AccountRow[], groups: readonly Group[] = []): RequestOverview {
  const logins = loginsOf(persons);
  const loginAddresses = new Set(logins.map((login) => login.id));
  // The addresses each person signs in with, by person id: the main one and the extra ones that may sign in
  const addressesOfPerson = new Map<string, string[]>();
  for (const login of logins) addressesOfPerson.set(login.personId, [...(addressesOfPerson.get(login.personId) ?? []), login.id]);
  const leaderIds = new Set(groups.flatMap((group) => [...group.leaderIds, ...(group.deputyLeaderIds ?? [])]));

  // Per address: how many requests, the latest of any kind, and the latest that was sent
  const tallies = new Map<string, { count: number; latest: string; latestSent: string | null }>();
  for (const request of requests) {
    const address = loginIdOf(request.email);
    if (address === "") continue;
    const tally = tallies.get(address) ?? { count: 0, latest: request.at, latestSent: null };
    tally.count += 1;
    if (time(request.at) > time(tally.latest)) tally.latest = request.at;
    if (request.result === "sent" && (tally.latestSent === null || time(request.at) > time(tally.latestSent))) tally.latestSent = request.at;
    tallies.set(address, tally);
  }

  // The latest sign-in of each address, over all its accounts
  const lastLogin = new Map<string, number>();
  for (const account of accounts) {
    const address = loginIdOf(account.email);
    if (address === "" || account.lastLoginAt === null) continue;
    lastLogin.set(address, Math.max(lastLogin.get(address) ?? 0, time(account.lastLoginAt)));
  }

  const askedNotSignedIn: AskedRow[] = [];
  for (const person of persons) {
    const addresses = addressesOfPerson.get(person.id) ?? [];
    // The latest request that was sent, on any of the person's addresses
    let latest: { address: string; at: string } | null = null;
    for (const address of addresses) {
      const at = tallies.get(address)?.latestSent;
      if (at && (latest === null || time(at) > time(latest.at))) latest = { address, at };
    }
    const best = latest;
    if (!best) continue;
    // Signed in on any of the addresses after that request: not asked and not signed in
    if (addresses.some((address) => (lastLogin.get(address) ?? 0) > time(best.at))) continue;
    const count = addresses.reduce((sum, address) => sum + (tallies.get(address)?.count ?? 0), 0);
    askedNotSignedIn.push({ person, address: best.address, latest: best.at, count, isLeader: leaderIds.has(person.id) });
  }
  askedNotSignedIn.sort((a, b) => Number(b.isLeader) - Number(a.isLeader) || a.person.name.localeCompare(b.person.name, "nb"));

  const askedNotInRegister = [...tallies.entries()]
    .filter(([address]) => !loginAddresses.has(address))
    .map(([address, tally]): StrangerRow => ({ address, latest: tally.latest, count: tally.count }))
    .sort((a, b) => time(b.latest) - time(a.latest));

  return { askedNotSignedIn, askedNotInRegister, totals: requestTotalsOf(requests) };
}
