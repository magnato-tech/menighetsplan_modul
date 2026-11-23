import { describe, expect, test } from "vitest";
import {
  membershipApplyVariant,
  membershipEnrollmentLink,
  membershipPageSettings,
  myMembershipView,
} from "../src/utils/membershipView";
import type { Group, Person } from "../src/types";

const base: Person = {
  id: "p1",
  name: "Kari",
  globalRole: "member",
};

const page = membershipPageSettings({
  churchName: "Eksempelmenigheten",
  denominationName: "Trossamfunnet Eksempel",
  denominationAdultEnrollmentUrl: "https://example.org/voksen",
  denominationChildEnrollmentUrl: "https://example.org/barn",
});

describe("Visning av medlemskap", () => {
  test("menighet og trossamfunn med dato og type", () => {
    const view = myMembershipView(
      {
        ...base,
        congregationMember: true,
        denominationMember: true,
        congregationJoinedAt: "2005-09-01",
        denominationJoinedAt: "2005-09-01",
        denominationEnrollmentType: "A",
      },
      [],
      page
    );
    expect(view.congregation).toMatchObject({
      title: "Eksempelmenigheten",
      isMember: true,
      status: "Medlem",
      detail: "Innmeldt 1. september 2005",
    });
    expect(view.denomination.title).toBe("Trossamfunnet Eksempel");
    expect(view.denomination.enrollmentType).toBe("A – innmeldt");
  });

  test("verken menighet eller trossamfunn: ett felles skjema", () => {
    const view = myMembershipView(base, [], page);
    expect(membershipApplyVariant(base)).toBe("combined");
    expect(view.congregation.isMember).toBe(false);
    expect(view.congregation.membershipAction).toBe("combinedApply");
    expect(view.denomination.membershipAction).toBeUndefined();
    expect(view.denomination.detail).toContain("felles skjema");
  });

  test("kun menighet: skjema bare for kirkesamfunn", () => {
    const person = { ...base, congregationMember: true as const };
    const view = myMembershipView(person, [], page);
    expect(membershipApplyVariant(person)).toBe("denominationOnly");
    expect(view.congregation.membershipAction).toBeUndefined();
    expect(view.denomination.membershipAction).toBe("denominationEnroll");
  });

  test("kun kirkesamfunn: skjema bare for menighet", () => {
    const person = { ...base, denominationMember: true as const };
    const view = myMembershipView(person, [], page);
    expect(membershipApplyVariant(person)).toBe("congregationOnly");
    expect(view.congregation.membershipAction).toBe("congregationApply");
    expect(view.denomination.membershipAction).toBeUndefined();
  });

  test("medlem uten dato", () => {
    const view = myMembershipView({ ...base, congregationMember: true }, [], page);
    expect(view.congregation.detail).toBe("Innmeldingsdato er ikke registrert");
  });

  test("grupper med innmeldingsdato", () => {
    const groups: Group[] = [
      {
        id: "g1",
        name: "Lovsang",
        memberIds: ["p1"],
        leaderIds: [],
        memberJoinedAt: { p1: "2026-01-15T10:00:00.000Z" },
      },
    ];
    const view = myMembershipView(base, groups, page);
    expect(view.groups[0]).toEqual({ groupName: "Lovsang", joined: "15. januar 2026" });
  });

  test("innmeldingsskjema for voksen menighetsmedlem", () => {
    const link = membershipEnrollmentLink(
      { congregationMember: true, birthDate: "2000-01-01" },
      page
    );
    expect(link?.url).toBe("https://example.org/voksen");
  });

  test("innmeldingsskjema barn under 15", () => {
    const link = membershipEnrollmentLink(
      { congregationMember: true, birthDate: "2015-06-01" },
      page
    );
    expect(link?.url).toBe("https://example.org/barn");
  });

  test("ingen skjema når ikke menighetsmedlem", () => {
    expect(membershipEnrollmentLink({ congregationMember: false, birthDate: "2000-01-01" }, page)).toBeNull();
  });
});