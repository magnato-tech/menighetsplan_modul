import type { MembershipApplication, Person } from "../types";
import { ageOn } from "./birthDate";

const OPEN_G_TO_A: ReadonlySet<MembershipApplication["status"]> = new Set([
  "submitted",
  "received",
  "cornerstoneDone",
]);

/** Child (G) membership in the denomination who has turned 15 and may apply for adult (A) type. */
export function needsDenominationGToAConfirmation(
  person: Pick<Person, "denominationMember" | "denominationEnrollmentType" | "birthDate">
): boolean {
  if (person.denominationMember !== true || person.denominationEnrollmentType !== "G") return false;
  const years = ageOn(person.birthDate);
  return years !== null && years >= 15;
}

export function hasOpenDenominationGToAApplication(
  personId: string,
  applications: readonly Pick<MembershipApplication, "personId" | "kind" | "status">[]
): boolean {
  return applications.some(
    (app) => app.personId === personId && app.kind === "denominationGToA" && OPEN_G_TO_A.has(app.status)
  );
}

export const G_TO_A_CLERK_PROCEDURE = [
  "Oppdater kartoteket i Cornerstone (utmeld G, innmeld A med samme overgangsdato).",
  "Merk «Ført inn i Cornerstone» når det er gjort.",
  "Fyll dato for G-utmeldelse og A-innmeldelse, og bekreft: da oppdateres personkortet automatisk.",
] as const;

/** Person fields written when a G→A application is completed. */
export function gToARegisterUpdate(
  transitionGEndedAt: string,
  transitionAStartedAt: string
): Pick<Person, "denominationMember" | "denominationEnrollmentType" | "denominationGEndedAt" | "denominationJoinedAt"> {
  return {
    denominationMember: true,
    denominationEnrollmentType: "A",
    denominationGEndedAt: transitionGEndedAt,
    denominationJoinedAt: transitionAStartedAt,
  };
}