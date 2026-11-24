import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "vitest";
import { LOGIN_LINK_DAYS, loginLinkUrl, safeDestination } from "../src/utils/loginLink";
import { emailHashOf, makeLoginToken, readLoginToken } from "../server/loginLinkToken";
import type { ServiceAccount } from "../server/serviceAccount";

const pem = () => generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } }).privateKey;
const account: ServiceAccount = { project_id: "menigheten", client_email: "tjeneste@menigheten.iam.example", private_key: pem() };
const NOW = 1_800_000_000;
const DAY = 86_400;

describe("Innloggingslenkens nøkkel", () => {
  test("en gyldig lenke sier hvem den er for, og er gyldig i 14 dager", () => {
    const token = makeLoginToken(account, "person-1", "Kari@Example.org", NOW);
    expect(readLoginToken(account, token, NOW)).toEqual({ personId: "person-1", emailHash: emailHashOf("kari@example.org") });
    expect(readLoginToken(account, token, NOW + LOGIN_LINK_DAYS * DAY - 1)).toMatchObject({ personId: "person-1" });
    expect(readLoginToken(account, token, NOW + LOGIN_LINK_DAYS * DAY)).toBe("expired");
  });

  test("adressen står ikke i lenken, bare et avtrykk, og en stor og liten bokstav i adressen gir samme avtrykk", () => {
    const token = makeLoginToken(account, "person-1", "  Kari@Example.ORG ", NOW);
    expect(token).not.toContain("kari");
    expect(emailHashOf("KARI@example.org")).toBe(emailHashOf("kari@example.org"));
  });

  test("en endret lenke, en endret signatur, eller en lenke fra en annen nøkkel, er ikke gyldig", () => {
    const token = makeLoginToken(account, "person-1", "kari@example.org", NOW);
    const [payload, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ p: "person-2", e: emailHashOf("kari@example.org"), x: NOW + DAY * 14 }), "utf8").toString("base64url");
    expect(readLoginToken(account, `${changed}.${signature}`, NOW)).toBe("invalid");
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    expect(readLoginToken(account, `${payload}.${flipped}`, NOW)).toBe("invalid");

    const other: ServiceAccount = { ...account, private_key: pem() };
    expect(readLoginToken(other, token, NOW)).toBe("invalid");
  });

  test("et ødelagt eller for langt token, og tomme deler, er ugyldig", () => {
    const token = makeLoginToken(account, "person-1", "kari@example.org", NOW);
    for (const wrong of [undefined, null, 7, "", "abc", ".", `${token}.ekstra`, "x".repeat(1001), token.split(".")[0] + ".", "." + token.split(".")[1]]) {
      expect(readLoginToken(account, wrong, NOW)).toBe("invalid");
    }
  });
});

describe("Adressen til lenken", () => {
  test("bare en adresse i appen kan være det lenken fører til", () => {
    expect(safeDestination("/minside/semesterplan/abc")).toBe("/minside/semesterplan/abc");
    expect(safeDestination("/minside?view=grupper")).toBe("/minside?view=grupper");
    for (const wrong of ["//evil.com", "https://x", "\\x", "", "minside", null, undefined, 7, `/${"a".repeat(300)}`]) {
      expect(safeDestination(wrong)).toBe("/minside");
    }
  });

  test("lenken har adressen til siden, /lenke, og sjetongen i fragmentet, så den ikke sendes til serveren", () => {
    expect(loginLinkUrl("https://menigheten.example/", "/minside/semesterplan/a", "tok.en")).toBe("https://menigheten.example/lenke?til=%2Fminside%2Fsemesterplan%2Fa#tok.en");
  });
});
