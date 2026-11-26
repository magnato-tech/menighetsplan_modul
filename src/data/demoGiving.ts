import { COLLECTIONS, GIVING_PLAIN_COLLECTIONS } from "./collections";
import type { MockDocument } from "./mockDocuments";
import type { Person } from "../types";

// The givertjeneste documents of the demo: the gift purposes, and the access given to two of the
// example congregation's persons. Each congregation in the demo gets its own copy (see
// scripts/reset-demo.ts), under its own id. There is no log: the demo starts without one.

/** The access that is given: the rights of givertjeneste, one by one. */
type GivingRights = { overview: boolean; budget: boolean; individual: boolean; manage: boolean };

const PURPOSE_DATA = [
  { id: "purpose-drift", name: "Menighetens arbeid", usage: "drift" },
  { id: "purpose-misjon", name: "Misjonsarbeid", usage: "oremerket" },
  { id: "purpose-barn", name: "Barn og unge", usage: "oremerket" },
] as const;

/**
 * The givertjeneste documents of the example congregation, as they are when the demo is reset: three
 * gift purposes, and access for the first two of its persons who are not administrators and have an
 * e-mail address (sorted by id). The first of them is signed in as in the demo (`googleId`), the
 * second is waiting for its first sign-in. The purposes and the access are written by the first
 * administrator of the example. Nothing is invented: without an administrator there is nothing,
 * and without two such persons only the persons there are get access.
 */
export function demoGivingDocuments(example: MockDocument[], now: number): MockDocument[] {
  const persons = example
    .filter((document) => document.collection === COLLECTIONS.PERSONS)
    .map((document) => ({ ...(document.data as Person), id: document.id }));
  const administrator = persons.find((person) => person.globalRole === "admin");
  if (!administrator) return [];

  const updatedAt = new Date(now).toISOString();
  const purposes: MockDocument[] = PURPOSE_DATA.map((purpose) => ({
    collection: GIVING_PLAIN_COLLECTIONS.PURPOSES,
    id: purpose.id,
    data: {
      name: purpose.name,
      usage: purpose.usage,
      active: true,
      createdAt: updatedAt,
      updatedAt,
      updatedBy: administrator.id,
    },
  }));

  const candidates = persons
    .filter((person) => person.globalRole !== "admin" && typeof person.email === "string" && person.email.trim() !== "")
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
    .slice(0, 2);

  const rights: GivingRights[] = [
    { overview: true, budget: true, individual: true, manage: false },
    { overview: false, budget: false, individual: false, manage: true },
  ];
  const access: MockDocument[] = candidates.map((person, index) => ({
    collection: GIVING_PLAIN_COLLECTIONS.ACCESS,
    id: (person.email ?? "").trim().toLowerCase(),
    data: {
      personId: person.id,
      name: person.name,
      ...rights[index],
      version: 1,
      updatedAt,
      updatedBy: administrator.id,
      ...(index === 0 ? { googleId: "demo" } : {}),
    },
  }));

  return [...purposes, ...access];
}
