// The token in a login link (see src/utils/loginLink.ts). It says which person it is for, a hash of
// the address it was sent to, and when it runs out, and it is signed with a key made from the
// service account's private key. So replacing that key makes every link already sent invalid.
//
// The token is: base64url(JSON {p, e, x}) + "." + base64url(HMAC-SHA256(key, the first part)).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { LOGIN_LINK_DAYS } from "../src/utils/loginLink";
import type { ServiceAccount } from "./serviceAccount";

const DAY_SECONDS = 86_400;
const TOKEN_MAX = 1000;

/** The key the tokens are signed with, made from the private key so that a new key ends every link. */
const keyOf = (account: ServiceAccount): Buffer => createHash("sha256").update(`menighetsplan-innloggingslenke:${account.private_key}`).digest();

const sign = (key: Buffer, text: string): string => createHmac("sha256", key).update(text, "utf8").digest("base64url");

/** A short hash of the address (lower case, no blanks), so the token does not hold the address itself. */
export const emailHashOf = (email: string): string => createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("base64url").slice(0, 22);

/** The token for one person, valid until `endSeconds`, or for LOGIN_LINK_DAYS from `nowSeconds` when no end is given. */
export function makeLoginToken(account: ServiceAccount, personId: string, email: string, nowSeconds: number, endSeconds?: number): string {
  const payload = Buffer.from(JSON.stringify({ p: personId, e: emailHashOf(email), x: endSeconds ?? nowSeconds + LOGIN_LINK_DAYS * DAY_SECONDS }), "utf8").toString("base64url");
  return `${payload}.${sign(keyOf(account), payload)}`;
}

/** What a token says, when it is genuine and still valid. "invalid" for anything else, "expired" when it has run out. */
export function readLoginToken(account: ServiceAccount, token: unknown, nowSeconds: number): { personId: string; emailHash: string } | "invalid" | "expired" {
  if (typeof token !== "string" || token.length > TOKEN_MAX) return "invalid";
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") return "invalid";
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(keyOf(account), payload), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "invalid";

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return "invalid";
  }
  const { p, e, x } = (data ?? {}) as Record<string, unknown>;
  if (typeof p !== "string" || p === "" || typeof e !== "string" || typeof x !== "number" || !Number.isFinite(x)) return "invalid";
  if (nowSeconds >= x) return "expired";
  return { personId: p, emailHash: e };
}
