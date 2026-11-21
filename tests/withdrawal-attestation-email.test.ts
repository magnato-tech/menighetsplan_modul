import { describe, expect, test } from "vitest";
import type { Person } from "../src/types";
import { DEFAULT_FROM_ADDRESS, EMAIL_DOCUMENT, PERSONS, SEND_URL, SETTINGS_DOCUMENT } from "../server/emailSending";
import { sendWithdrawalAttestationEmail } from "../server/withdrawalAttestationEmail";
import type { Fetch } from "../server/firestoreRest";

const env = {
  VITE_FIREBASE_API_KEY: "key",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM_ADDRESS: "ikke-svar@menighetsplan.no",
};

const fieldsOf = (data: object) =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "boolean" ? { booleanValue: value } : { stringValue: String(value) },
    ])
  );

const clerk: Person = {
  id: "clerk",
  name: "Pernille Protokoll",
  email: "pernille@example.org",
  membershipClerk: true,
  globalRole: "member",
};

const member: Person = {
  id: "member",
  name: "Kari Klok",
  email: "kari@example.org",
  globalRole: "member",
};

const tokenFor = (email: string) => {
  const payload = Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url");
  return `h.${payload}.s`;
};

describe("Utmeldingsattest på e-post", () => {
  test("sender til medlem med kopi til svaradresse", async () => {
    const sent: unknown[] = [];
    const ask: Fetch = async (url, init) => {
      if (url === SEND_URL) {
        sent.push(JSON.parse(init?.body ?? "[]"));
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (url.includes("/logins/")) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ personId: "clerk" }) }) };
      }
      if (url.includes(`/${PERSONS}/clerk`)) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf(clerk) }) };
      }
      if (url.includes(`/${PERSONS}/member`)) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf(member) }) };
      }
      if (url.includes("/membershipClerkTasks/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: url,
            fields: fieldsOf({
              id: "w1",
              kind: "withdrawal",
              status: "open",
              personId: "member",
              personName: "Kari Klok",
              cornerstoneUpdated: true,
              withdrawCongregation: true,
              withdrawalDate: "2026-11-01",
            }),
          }),
        };
      }
      if (url.includes(SETTINGS_DOCUMENT)) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ churchName: "Eksempelmenigheten" }) }) };
      }
      if (url.includes(EMAIL_DOCUMENT)) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ recordType: "email", replyTo: "post@eksempelmenighet.no" }) }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const result = await sendWithdrawalAttestationEmail({
      env,
      siteUrl: "https://menigheten.example",
      idToken: tokenFor("pernille@example.org"),
      body: { mode: "withdrawalAttestation", taskId: "w1" },
      ask,
      wait: async () => undefined,
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.to).toBe("kari@example.org");
      expect(result.body.copyTo).toBe("post@eksempelmenighet.no");
    }
    expect(sent).toHaveLength(1);
    const batch = sent[0] as { from: string; to: string[]; cc: string[]; attachments: { filename: string }[] }[];
    expect(batch[0].to).toEqual(["kari@example.org"]);
    expect(batch[0].cc).toEqual(["post@eksempelmenighet.no"]);
    expect(batch[0].attachments[0].filename).toContain("utmeldingsattest");
    expect(batch[0].from).toContain(DEFAULT_FROM_ADDRESS);
  });

  test("nekter uten Cornerstone", async () => {
    const ask: Fetch = async (url) => {
      if (url.includes("/logins/")) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ personId: "clerk" }) }) };
      }
      if (url.includes(`/${PERSONS}/clerk`)) {
        return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf(clerk) }) };
      }
      if (url.includes("/membershipClerkTasks/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: url,
            fields: fieldsOf({
              id: "w1",
              kind: "withdrawal",
              status: "open",
              personId: "member",
              personName: "Kari",
            }),
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const result = await sendWithdrawalAttestationEmail({
      env,
      siteUrl: "https://menigheten.example",
      idToken: tokenFor("pernille@example.org"),
      body: { taskId: "w1" },
      ask,
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) expect(result.body.message).toContain("Cornerstone");
  });
});