import type { Group, Person } from "../types";
import { ageOn, formatBirthDate } from "./birthDate";
import { isInGroup } from "./groups";
import { hasOpenDenominationGToAApplication, needsDenominationGToAConfirmation } from "./denominationGToA";
import type { MembershipApplication } from "../types";

export type MembershipAction =
  | "combinedApply"
  | "congregationApply"
  | "denominationEnroll"
  | "denominationGToA";

/** Which membership form applies: both levels, congregation only, or denomination only. */
export type MembershipApplyVariant = "combined" | "congregationOnly" | "denominationOnly";

export function membershipApplyVariant(
  person: Pick<Person, "congregationMember" | "denominationMember">
): MembershipApplyVariant | null {
  const inCongregation = person.congregationMember === true;
  const inDenomination = person.denominationMember === true;
  if (inCongregation && inDenomination) return null;
  if (!inCongregation && !inDenomination) return "combined";
  if (!inCongregation) return "congregationOnly";
  return "denominationOnly";
}

export interface MembershipTierLine {
  title: string;
  isMember: boolean;
  status: string;
  detail?: string;
  enrollmentType?: string;
  /** Shown when the person is not a member at this level (no link until forms are configured). */
  membershipAction?: MembershipAction;
  /** Extra action while already a member (G→A ved 15 år). */
  followUpAction?: MembershipAction;
}

export interface GroupMembershipLine {
  groupName: string;
  joined?: string;
}

export interface MembershipEnrollmentLink {
  label: string;
  url: string;
}

export interface MembershipPageSettings {
  churchName: string;
  denominationName: string;
  adultEnrollmentUrl?: string;
  childEnrollmentUrl?: string;
}

export interface MyMembershipView {
  congregation: MembershipTierLine;
  denomination: MembershipTierLine;
  groups: GroupMembershipLine[];
  enrollmentLink: MembershipEnrollmentLink | null;
}

const DEFAULT_DENOMINATION_NAME = "Kirkesamfunnet";

export const DENOMINATION_ENROLLMENT_LABELS: Record<NonNullable<Person["denominationEnrollmentType"]>, string> = {
  A: "A – innmeldt",
  G: "G – barn innmeldt med foreldre",
};

/** Settings the membership page reads from the congregation's CMS settings. */
export function membershipPageSettings(settings: {
  churchName?: string;
  denominationName?: string;
  denominationAdultEnrollmentUrl?: string;
  denominationChildEnrollmentUrl?: string;
}): MembershipPageSettings {
  return {
    churchName: settings.churchName?.trim() || "Menigheten",
    denominationName: settings.denominationName?.trim() || DEFAULT_DENOMINATION_NAME,
    adultEnrollmentUrl: settings.denominationAdultEnrollmentUrl?.trim() || undefined,
    childEnrollmentUrl: settings.denominationChildEnrollmentUrl?.trim() || undefined,
  };
}

const tierLine = (
  title: string,
  isMember: boolean,
  joinedAt: string | undefined,
  membershipAction: MembershipAction | undefined,
  enrollmentType?: Person["denominationEnrollmentType"],
  followUpAction?: MembershipAction
): MembershipTierLine => {
  const enrollmentTypeText =
    enrollmentType && isMember ? DENOMINATION_ENROLLMENT_LABELS[enrollmentType] : undefined;
  if (!isMember) {
    return {
      title,
      isMember: false,
      status: "Ikke medlem",
      enrollmentType: enrollmentTypeText,
      membershipAction,
    };
  }
  const detail = joinedAt
    ? `Innmeldt ${formatBirthDate(joinedAt)}`
    : "Innmeldingsdato er ikke registrert";
  return { title, isMember: true, status: "Medlem", detail, enrollmentType: enrollmentTypeText, followUpAction };
};

/**
 * Link to the denomination's enrollment form when the person is a congregation member and a URL is set.
 * Adults (15+) get the adult form; under 15 gets the child form; unknown age falls back to the adult URL.
 */
export function membershipEnrollmentLink(
  person: Pick<Person, "congregationMember" | "birthDate">,
  page: Pick<MembershipPageSettings, "adultEnrollmentUrl" | "childEnrollmentUrl">
): MembershipEnrollmentLink | null {
  if (person.congregationMember !== true) return null;
  const adult = page.adultEnrollmentUrl;
  const child = page.childEnrollmentUrl;
  const years = ageOn(person.birthDate);
  if (years !== null && years < 15) {
    return child ? { label: "Innmeldingsskjema barn i trossamfunnet", url: child } : null;
  }
  if (adult) {
    return {
      label: years !== null && years >= 15 ? "Innmeldingsskjema i trossamfunnet" : "Innmeldingsskjema i trossamfunnet (fra 15 år)",
      url: adult,
    };
  }
  return child ? { label: "Innmeldingsskjema barn i trossamfunnet", url: child } : null;
}

/** What «Mitt medlemskap» shows for one person. */
export function myMembershipView(
  person: Pick<
    Person,
    | "congregationMember"
    | "denominationMember"
    | "congregationJoinedAt"
    | "denominationJoinedAt"
    | "denominationEnrollmentType"
    | "id"
    | "birthDate"
  >,
  groups: readonly Group[],
  page: MembershipPageSettings,
  myApplications: readonly Pick<MembershipApplication, "personId" | "kind" | "status">[] = []
): MyMembershipView {
  const mine = groups.filter((group) => isInGroup(group, person.id));
  const applyVariant = membershipApplyVariant(person);
  const congregationAction: MembershipAction | undefined =
    applyVariant === "combined"
      ? "combinedApply"
      : applyVariant === "congregationOnly"
        ? "congregationApply"
        : undefined;
  const denominationAction: MembershipAction | undefined =
    applyVariant === "denominationOnly" ? "denominationEnroll" : undefined;

  const congregation = tierLine(
    page.churchName,
    person.congregationMember === true,
    person.congregationJoinedAt,
    congregationAction
  );
  const gToAOpen = hasOpenDenominationGToAApplication(person.id, myApplications);
  const denominationFollowUp =
    needsDenominationGToAConfirmation(person) && !gToAOpen ? ("denominationGToA" as const) : undefined;
  const denomination = tierLine(
    page.denominationName,
    person.denominationMember === true,
    person.denominationJoinedAt,
    denominationAction,
    person.denominationMember === true ? person.denominationEnrollmentType : undefined,
    denominationFollowUp
  );
  if (applyVariant === "combined" && !denomination.isMember) {
    denomination.detail =
      "Med ett felles skjema kan du søke medlemskap i menigheten og melde deg inn i trossamfunnet.";
  }

  return {
    congregation,
    denomination,
    groups: mine
      .map((group) => ({
        groupName: group.name,
        joined: group.memberJoinedAt?.[person.id]
          ? formatBirthDate(group.memberJoinedAt[person.id].slice(0, 10))
          : undefined,
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName, "nb")),
    enrollmentLink: membershipEnrollmentLink(person, page),
  };
}