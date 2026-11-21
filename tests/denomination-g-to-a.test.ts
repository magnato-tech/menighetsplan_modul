import { describe, expect, test } from "vitest";
import {
  gToARegisterUpdate,
  hasOpenDenominationGToAApplication,
  needsDenominationGToAConfirmation,
} from "../src/utils/denominationGToA";
import { myMembershipView } from "../src/utils/membershipView";

describe("G → A ved 15 år", () => {
  test("viser bekreftelse for G over 15", () => {
    const person = {
      id: "p1",
      birthDate: "2008-01-01",
      congregationMember: true as const,
      denominationMember: true as const,
      denominationEnrollmentType: "G" as const,
    };
    expect(needsDenominationGToAConfirmation(person)).toBe(true);
    const view = myMembershipView(person, [], { churchName: "M", denominationName: "K" }, []);
    expect(view.denomination.followUpAction).toBe("denominationGToA");
  });

  test("registeroppdatering ved bekreftelse", () => {
    expect(gToARegisterUpdate("2026-03-01", "2026-03-01")).toEqual({
      denominationMember: true,
      denominationEnrollmentType: "A",
      denominationGEndedAt: "2026-03-01",
      denominationJoinedAt: "2026-03-01",
    });
  });

  test("skjuler knapp ved åpen oppgave", () => {
    const person = {
      id: "p1",
      birthDate: "2008-01-01",
      congregationMember: true as const,
      denominationMember: true as const,
      denominationEnrollmentType: "G" as const,
    };
    const apps = [{ personId: "p1", kind: "denominationGToA" as const, status: "submitted" as const }];
    expect(hasOpenDenominationGToAApplication("p1", apps)).toBe(true);
    expect(myMembershipView(person, [], { churchName: "M", denominationName: "K" }, apps).denomination.followUpAction).toBeUndefined();
  });
});