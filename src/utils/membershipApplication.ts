import type { MembershipApplicationKind, Person } from "../types";
import { ageOn } from "./birthDate";

/** Shown on membership forms and «Mitt medlemskap». */
export const MEMBERSHIP_ARCHIVE_NOTICE =
  "Innmeldingsskjemaer arkiveres konfidensielt i menighetens arkiv (fysisk eller digitalt).";

export const MEMBERSHIP_CONGREGATION_APPLY_PATH = "/minside/medlemskap/soknad-menighet";
export const MEMBERSHIP_DENOMINATION_ENROLL_PATH = "/minside/medlemskap/innmelding-kirkesamfunn";
export const MEMBERSHIP_DENOMINATION_CHILD_PATH = "/minside/medlemskap/innmelding-kirkesamfunn/barn";
export const MEMBERSHIP_DENOMINATION_G_TO_A_PATH = "/minside/medlemskap/bekreft-voksen";

import type { MembershipAction } from "./membershipView";

/** Where the button on «Mitt medlemskap» should lead. */
export function membershipFormPath(action: MembershipAction, person: Pick<Person, "birthDate">): string {
  if (action === "congregationApply" || action === "combinedApply") return MEMBERSHIP_CONGREGATION_APPLY_PATH;
  if (action === "denominationGToA") return MEMBERSHIP_DENOMINATION_G_TO_A_PATH;
  const years = ageOn(person.birthDate);
  if (years !== null && years < 15) return MEMBERSHIP_DENOMINATION_CHILD_PATH;
  return MEMBERSHIP_DENOMINATION_ENROLL_PATH;
}

/** Whether the signed-in person can fill the adult denomination form themselves. */
export function canSelfSubmitDenominationAdult(birthDate: string | undefined): boolean {
  const years = ageOn(birthDate);
  return years === null || years >= 15;
}

export const splitRegisteredName = (name: string): { lastName: string; firstNames: string } => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstNames: "" };
  if (parts.length === 1) return { lastName: parts[0], firstNames: "" };
  return { lastName: parts[parts.length - 1], firstNames: parts.slice(0, -1).join(" ") };
};

export const nationalIdValid = (value: string): boolean => /^\d{11}$/.test(value.replace(/\s/g, ""));

export type CongregationApplyInput = {
  lastName: string;
  firstNames: string;
  address: string;
  phone: string;
  email: string;
  nationalId: string;
  baptized: boolean | null;
  baptizedDate: string;
  alsoDenomination: boolean;
  notOtherDenomination: boolean;
  childrenToEnroll: boolean;
  signaturePlace: string;
  signatureDate: string;
};

export type DenominationAdultInput = Omit<
  CongregationApplyInput,
  "alsoDenomination" | "childrenToEnroll" | "notOtherDenomination"
> & { notOtherDenomination: boolean };

export type DenominationChildInput = {
  childLastName: string;
  childFirstNames: string;
  childNationalId: string;
  childBirthPlace: string;
  childBaptized: boolean | null;
  childBaptizedDate: string;
  parent1Name: string;
  parent2Name: string;
  childFromOtherDenomination: boolean;
  childAttestationAttached: boolean;
  signaturePlace: string;
  signatureDate: string;
  parent2ConfirmNoOther: boolean;
  parent2SignaturePlace: string;
  parent2SignatureDate: string;
};

const trimmed = (s: string) => s.trim();

export function validateCongregationApply(
  input: CongregationApplyInput,
  opts: {
    requireBaptizedDate: boolean;
    alreadyDenominationMember?: boolean;
    /** When set, «annet trossamfunn» is only required if enrolling in the denomination here. */
    enrollingInDenomination?: boolean;
  }
): string | null {
  if (!trimmed(input.lastName)) return "Skriv etternavn.";
  if (!trimmed(input.firstNames)) return "Skriv fornavn eller mellomnavn.";
  if (!trimmed(input.address)) return "Skriv adresse.";
  if (!trimmed(input.phone)) return "Skriv mobiltelefon.";
  if (!trimmed(input.email)) return "Skriv e-post.";
  if (!nationalIdValid(input.nationalId)) return "Fødselsnummer må være 11 siffer.";
  if (input.baptized === null) return "Oppgi om du er døpt.";
  if (opts.requireBaptizedDate && input.baptized && !trimmed(input.baptizedDate)) return "Skriv døpsdato.";
  const enrollingInDenomination =
    opts.enrollingInDenomination === true || (!opts.alreadyDenominationMember && input.alsoDenomination);
  if (!opts.alreadyDenominationMember && enrollingInDenomination && !input.notOtherDenomination) {
    return "Du må bekrefte at du ikke er medlem i et annet trossamfunn.";
  }
  if (!trimmed(input.signaturePlace)) return "Skriv sted for signatur.";
  if (!trimmed(input.signatureDate)) return "Skriv dato for signatur.";
  return null;
}

export function validateDenominationAdult(input: DenominationAdultInput): string | null {
  const base: CongregationApplyInput = {
    ...input,
    alsoDenomination: true,
    childrenToEnroll: false,
  };
  return validateCongregationApply(base, { requireBaptizedDate: true });
}

export function validateDenominationChild(input: DenominationChildInput): string | null {
  if (!trimmed(input.childLastName)) return "Skriv barnets etternavn.";
  if (!trimmed(input.childFirstNames)) return "Skriv barnets fornavn eller mellomnavn.";
  if (!nationalIdValid(input.childNationalId)) return "Barnets fødselsnummer må være 11 siffer.";
  if (!trimmed(input.childBirthPlace)) return "Skriv fødested.";
  if (input.childBaptized === null) return "Oppgi om barnet er døpt.";
  if (input.childBaptized && !trimmed(input.childBaptizedDate)) return "Skriv døpsdato.";
  if (!trimmed(input.parent1Name)) return "Skriv navn på forelder 1.";
  if (!trimmed(input.signaturePlace)) return "Skriv sted for forelder 1.";
  if (!trimmed(input.signatureDate)) return "Skriv dato for forelder 1.";
  if (input.childFromOtherDenomination && !input.childAttestationAttached) {
    return "Bekreft at utmeldingsattest er vedlagt, eller kryss av at barnet ikke kommer fra annet trossamfunn.";
  }
  return null;
}

export const membershipApplicationKindLabel: Record<MembershipApplicationKind, string> = {
  congregationApply: "Søknad om medlemskap i menigheten",
  denominationAdultEnroll: "Innmelding i trossamfunnet",
  denominationChildEnroll: "Innmelding av barn i trossamfunnet",
  denominationGToA: "Bekreftelse av voksenmedlemskap (G → A)",
};