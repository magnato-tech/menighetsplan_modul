import { describe, expect, test } from "vitest";
import type { Person } from "../src/types";
import { extraEmailsError, extraEmailsToStore, sharedEmailWarnings, withExtraEmail } from "../src/utils/personForm";

// Every person and address here is made up.

describe("Ekstra e-postadresser i personskjemaet", () => {
  test("tomme rader er ikke en feil, og en adresse som ikke er en adresse, sies fra om", () => {
    expect(extraEmailsError([{ address: "  ", copy: false, login: true }], "kari@eksempel.no")).toBeNull();
    expect(extraEmailsError([{ address: "ola@eksempel.no", copy: false, login: true }], "kari@eksempel.no")).toBeNull();
    expect(extraEmailsError([{ address: "ola@", copy: false, login: true }], "kari@eksempel.no")).toBe("ola@ er ikke en gyldig e-postadresse.");
  });

  test("en adresse som er hovedadressen, eller står to ganger, sies fra om", () => {
    expect(extraEmailsError([{ address: "Kari@eksempel.no", copy: true, login: false }], "kari@eksempel.no")).toBe(
      "kari@eksempel.no står allerede på personen."
    );
    const twice = [
      { address: "ola@eksempel.no", copy: false, login: true },
      { address: "OLA@eksempel.no", copy: true, login: false },
    ];
    expect(extraEmailsError(twice, null)).toBe("ola@eksempel.no står allerede på personen.");
  });

  test("lagret blir adressene med små bokstaver, uten tomme rader, uten hovedadressen og uten to like", () => {
    const rows = [
      { address: " Ola@Eksempel.no ", copy: true, login: false },
      { address: "", copy: false, login: true },
      { address: "kari@eksempel.no", copy: true, login: true },
      { address: "ola@eksempel.no", copy: false, login: true },
    ];
    expect(extraEmailsToStore(rows, "kari@eksempel.no")).toEqual([{ address: "ola@eksempel.no", copy: true, login: false }]);
  });

  test("den som legges til fra Innlogging, får den som kan logge inn og ikke kopi", () => {
    const kari = { email: "kari@eksempel.no", extraEmails: [{ address: "kari.jobb@eksempel.no", copy: true, login: false }] };
    expect(withExtraEmail(kari, " Kari.Logg@Eksempel.no ")).toEqual({
      ok: true,
      extraEmails: [
        { address: "kari.jobb@eksempel.no", copy: true, login: false },
        { address: "kari.logg@eksempel.no", copy: false, login: true },
      ],
    });
    expect(withExtraEmail({ email: undefined }, "ola@eksempel.no")).toEqual({ ok: true, extraEmails: [{ address: "ola@eksempel.no", copy: false, login: true }] });
  });

  test("en adresse som allerede står på personen, eller ikke er en adresse, legges ikke til", () => {
    const kari = { email: "kari@eksempel.no", extraEmails: [{ address: "kari.jobb@eksempel.no", copy: true, login: false }] };
    expect(withExtraEmail(kari, "KARI@eksempel.no")).toEqual({ ok: false, message: "kari@eksempel.no står allerede på personen." });
    expect(withExtraEmail(kari, "kari.jobb@eksempel.no")).toEqual({ ok: false, message: "kari.jobb@eksempel.no står allerede på personen." });
    expect(withExtraEmail(kari, "ikke en adresse")).toEqual({ ok: false, message: "ikke en adresse er ikke en gyldig e-postadresse." });
  });

  test("en adresse som kan logge inn, og står på to personer, er delt, og begge nevnes", () => {
    const kari: Person = { id: "kari", name: "Kari", email: "kari@eksempel.no", globalRole: "member" };
    const ola: Person = { id: "ola", name: "Ola", email: "ola@eksempel.no", globalRole: "member", extraEmails: [{ address: "kari@eksempel.no", copy: false, login: true }] };
    expect(sharedEmailWarnings([kari, ola])).toEqual([{ address: "kari@eksempel.no", names: ["Kari", "Ola"] }]);
  });
});
