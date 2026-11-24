import { describe, expect, test } from "vitest";
import type { Person } from "../src/types";
import { copyAddressesOf, extraEmailsOf, loginAddressesOf } from "../src/utils/personEmails";
import { personsWithEmail } from "../src/utils/session";

// Every person and address here is made up.

const kari: Person = {
  id: "kari",
  name: "Kari Nordmann",
  email: " Kari@Eksempel.no ",
  globalRole: "member",
  extraEmails: [
    { address: "kari.jobb@eksempel.no", copy: true, login: false },
    { address: "KARI.Logg@Eksempel.no", copy: false, login: true },
  ],
};

describe("Ekstra e-postadresser slik de er lagret", () => {
  test("det som ikke er en adresse med begge valgene, sløyfes, og resten står som det er", () => {
    expect(extraEmailsOf(undefined)).toEqual([]);
    expect(extraEmailsOf("kari@eksempel.no")).toEqual([]);
    expect(
      extraEmailsOf([
        { address: "ola@eksempel.no", copy: true, login: false },
        { address: "uten-valg@eksempel.no", copy: true },
        { copy: true, login: true },
        null,
        "ola@eksempel.no",
        { address: 7, copy: true, login: true },
      ])
    ).toEqual([{ address: "ola@eksempel.no", copy: true, login: false }]);
  });
});

describe("Hvilke adresser en person kan logge inn med", () => {
  test("hovedadressen og de ekstra som kan logge inn, med små bokstaver, og hver adresse bare én gang", () => {
    expect(loginAddressesOf(kari)).toEqual(["kari@eksempel.no", "kari.logg@eksempel.no"]);
    expect(loginAddressesOf({ email: "kari@eksempel.no", extraEmails: [{ address: "Kari@eksempel.no", copy: false, login: true }] })).toEqual([
      "kari@eksempel.no",
    ]);
  });

  test("en ekstra adresse som bare får kopi, kan ikke logge inn", () => {
    expect(loginAddressesOf(kari)).not.toContain("kari.jobb@eksempel.no");
  });

  test("uten brukbar hovedadresse er det bare de ekstra som kan logge inn, og uten noen er det ingen", () => {
    expect(loginAddressesOf({ email: "ikke en adresse", extraEmails: [{ address: "ola@eksempel.no", copy: false, login: true }] })).toEqual([
      "ola@eksempel.no",
    ]);
    expect(loginAddressesOf({ email: undefined })).toEqual([]);
  });
});

describe("Hvilke adresser som får kopi av e-post fra admin", () => {
  test("de ekstra med kopi, uten hovedadressen, og hver adresse bare én gang", () => {
    expect(copyAddressesOf(kari)).toEqual(["kari.jobb@eksempel.no"]);
    expect(
      copyAddressesOf({
        email: "ola@eksempel.no",
        extraEmails: [
          { address: "ola@eksempel.no", copy: true, login: false },
          { address: "ola.to@eksempel.no", copy: true, login: false },
          { address: "ola.to@eksempel.no", copy: true, login: true },
        ],
      })
    ).toEqual(["ola.to@eksempel.no"]);
  });

  test("en ekstra adresse uten kopi får ingen e-post fra admin", () => {
    expect(copyAddressesOf({ email: "ola@eksempel.no", extraEmails: [{ address: "ola.logg@eksempel.no", copy: false, login: true }] })).toEqual([]);
  });
});

describe("Hvem som har en adresse når den kan brukes til å logge inn", () => {
  test("en ekstra adresse som kan logge inn, peker ut personen; en som bare får kopi, gjør det ikke", () => {
    const ola: Person = { id: "ola", name: "Ola", email: "ola@eksempel.no", globalRole: "member" };
    expect(personsWithEmail("KARI.logg@eksempel.no", [kari, ola])).toEqual([kari]);
    expect(personsWithEmail("kari.jobb@eksempel.no", [kari, ola])).toEqual([]);
  });
});
