import { describe, expect, test } from "vitest";
import type { AccountRow } from "../src/utils/accountOverview";
import type { LoginRequest } from "../src/utils/loginRequests";
import { requestOverviewOf } from "../src/utils/loginRequests";
import type { Group, Person } from "../src/types";

// The requests for a sign-in link, against made-up people and accounts

const person = (id: string, name: string, email?: string): Person => ({ id, name, email, globalRole: "member" }) as Person;
const persons = [person("ola", "Ola Hansen", "ola@eksempel.no"), person("kari", "Kari Leder", "kari@eksempel.no"), person("uten", "Ulf Uten")];

const request = (email: string, at: string, result: LoginRequest["result"], inRegister = true): LoginRequest => ({ email, at, inRegister, result });
const account = (email: string, lastLoginAt: string | null): AccountRow => ({ email, emailVerified: true, disabled: false, provider: "e-postlenke", createdAt: null, lastLoginAt });

const MONDAY = "2026-11-16T10:00:00.000Z";
const WEDNESDAY = "2026-11-18T10:00:00.000Z";
const FRIDAY = "2026-11-20T10:00:00.000Z";

describe("Hvem som har bedt om lenke, men ikke logget inn", () => {
  test("den som har fått lenke og senere logget inn, står ikke på listen", () => {
    const overview = requestOverviewOf([request("ola@eksempel.no", MONDAY, "sent")], persons, [account("ola@eksempel.no", FRIDAY)]);
    expect(overview.askedNotSignedIn).toEqual([]);
  });

  test("den som har fått lenke og aldri logget inn, står på listen med antall forespørsler", () => {
    const overview = requestOverviewOf(
      [request("ola@eksempel.no", MONDAY, "sent"), request("ola@eksempel.no", WEDNESDAY, "sent"), request("ola@eksempel.no", FRIDAY, "limited")],
      persons,
      []
    );
    expect(overview.askedNotSignedIn).toEqual([
      expect.objectContaining({ person: persons[0], address: "ola@eksempel.no", latest: WEDNESDAY, count: 3, isLeader: false }),
    ]);
  });

  test("den som logget inn før forespørselen, men ikke etter den, står på listen", () => {
    const overview = requestOverviewOf([request("ola@eksempel.no", FRIDAY, "sent")], persons, [account("ola@eksempel.no", MONDAY)]);
    expect(overview.askedNotSignedIn).toHaveLength(1);
  });

  test("en adresse som bare er stoppet eller har feilet, står ikke på listen, men teller i summen", () => {
    const overview = requestOverviewOf([request("ola@eksempel.no", MONDAY, "limited"), request("ola@eksempel.no", WEDNESDAY, "failed")], persons, []);
    expect(overview.askedNotSignedIn).toEqual([]);
    expect(overview.totals).toEqual({ requests: 2, sent: 0, limited: 1, failed: 1 });
  });

  test("en adresse som ikke står i registeret, står på den andre listen, nyeste først", () => {
    const overview = requestOverviewOf(
      [request("fremmed@eksempel.no", MONDAY, "sent", false), request("ny@eksempel.no", FRIDAY, "limited", false), request("fremmed@eksempel.no", WEDNESDAY, "sent", false)],
      persons,
      []
    );
    expect(overview.askedNotInRegister).toEqual([
      { address: "ny@eksempel.no", latest: FRIDAY, count: 1 },
      { address: "fremmed@eksempel.no", latest: WEDNESDAY, count: 2 },
    ]);
    expect(overview.askedNotSignedIn).toEqual([]);
  });

  test("gruppelederne står først på listen, deretter etter navn", () => {
    const groups = [{ id: "lyd", name: "Lyd", leaderIds: ["kari"], memberIds: [] }] as unknown as Group[];
    const overview = requestOverviewOf(
      [request("ola@eksempel.no", MONDAY, "sent"), request("kari@eksempel.no", FRIDAY, "sent")],
      persons,
      [],
      groups
    );
    expect(overview.askedNotSignedIn.map((row) => row.person.name)).toEqual(["Kari Leder", "Ola Hansen"]);
    expect(overview.askedNotSignedIn[0].isLeader).toBe(true);
  });

  test("telt i summen: alle forespørsler, og hva som ble av dem", () => {
    const overview = requestOverviewOf(
      [request("ola@eksempel.no", MONDAY, "sent"), request("ola@eksempel.no", WEDNESDAY, "limited"), request("fremmed@eksempel.no", FRIDAY, "failed", false)],
      persons,
      []
    );
    expect(overview.totals).toEqual({ requests: 3, sent: 1, limited: 1, failed: 1 });
  });
});
