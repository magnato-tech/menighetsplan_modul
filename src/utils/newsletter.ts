// The newsletter: the e-mail to the members, or to everyone in the register, that one can
// unsubscribe from. Who has unsubscribed, and the banner at the top, are told here; the e-mail
// itself is made in utils/emailMessage.ts and sent in server/emailSending.ts.
//
// Unsubscribing needs no sign-in. Every person the newsletter is sent to gets a key of their own
// (`newsletterToken` on the person, written where the e-mail is sent), and the link in the e-mail
// carries it. Pressing the button on that page writes one document named by the key, and nothing
// else, in the collection below. Only an administrator can list them, and so tell which person
// a key belongs to.

/** Where the unsubscribe page is: /avmelding/<key>. */
export const UNSUBSCRIBE_PATH = "/avmelding";

/** The key in the link of a test e-mail. It unsubscribes nobody: the page says it was a test. */
export const TEST_UNSUBSCRIBE_TOKEN = "prove";

/** A key as it is made: 32 letters, digits, "-" and "_". The database rules ask the same. */
export const NEWSLETTER_TOKEN = /^[A-Za-z0-9_-]{32}$/;

export const isNewsletterToken = (value: unknown): value is string => typeof value === "string" && NEWSLETTER_TOKEN.test(value);

const KEY_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** A new key, from 32 random bytes (`crypto.getRandomValues`, in the browser and in Node alike). */
export function newNewsletterToken(random: (bytes: Uint8Array) => Uint8Array = (bytes) => globalThis.crypto.getRandomValues(bytes)): string {
  return Array.from(random(new Uint8Array(32)), (byte) => KEY_LETTERS[byte % 64]).join("");
}

export const unsubscribeUrlOf = (siteUrl: string, token: string): string => `${siteUrl.replace(/\/+$/, "")}${UNSUBSCRIBE_PATH}/${encodeURIComponent(token)}`;

/** The persons whose key is among the unsubscribed ones. */
export function optedOutPersonIds(persons: readonly { id: string; newsletterToken?: string }[], unsubscribedTokens: Iterable<string>): Set<string> {
  const tokens = new Set(unsubscribedTokens);
  return new Set(persons.filter((person) => person.newsletterToken !== undefined && tokens.has(person.newsletterToken)).map((person) => person.id));
}

// ---------- The banner ----------

/** Where the banner is fetched from by the inbox. A picture inside the e-mail is not shown by most of them. */
export const NEWSLETTER_BANNER_PATH = "/api/nyhetsbrevbilde";

export const NEWSLETTER_BANNER_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** What the banner is, read without trusting what is stored. */
export type NewsletterBanner =
  /** A picture uploaded in admin, stored as text: the hosting serves it from the stored text. */
  | { kind: "stored"; contentType: string; base64: string }
  /** A picture with an address of its own: from the picture library, or elsewhere on the web. */
  | { kind: "address"; url: string };

export function newsletterBannerOf(imageUrl: unknown): NewsletterBanner | null {
  if (typeof imageUrl !== "string") return null;
  const value = imageUrl.trim();
  const stored = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (stored) return NEWSLETTER_BANNER_TYPES.includes(stored[1]) ? { kind: "stored", contentType: stored[1], base64: stored[2] } : null;
  if (/^https:\/\/[^\s"'<>]+$/.test(value) || /^\/(?!\/)[^\s"'<>]*$/.test(value)) return { kind: "address", url: value };
  return null;
}

/**
 * The address the inbox fetches the banner from. It changes when the banner does (`version`),
 * so an inbox that has kept an old one, fetches the new.
 */
export const newsletterBannerUrlOf = (siteUrl: string, version: string): string =>
  `${siteUrl.replace(/\/+$/, "")}${NEWSLETTER_BANNER_PATH}?v=${encodeURIComponent(version)}`;
