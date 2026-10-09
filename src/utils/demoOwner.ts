// The owner of the demo: the vendor, who decides how the demo is set up (which congregations
// every visitor is offered, see utils/demoSite.ts).
//
// Nobody signs in to the demo, so the owner is known by a code. The demo's settings hold a
// fingerprint of it (VITE_DEMO_OWNER_CODE_HASH), never the code itself: the settings are built
// into the app, where anyone can read them. The owner types the code once in their browser.
//
// The code keeps the owner's screen away from visitors. It does not protect the database: the
// demo's database has open rules, and is filled anew every night.

/** A short code could be found by trying, since the fingerprint can be read by anyone. */
export const MIN_OWNER_CODE_LENGTH = 12;

/** The fingerprint of a code: SHA-256, as 64 hexadecimal digits. Spaces around the code do not count. */
export async function ownerCodeHashOf(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code.trim()));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Whether the code is the owner's. Without a fingerprint in the settings nobody is the owner. */
export async function isOwnerCode(code: string, expectedHash: string | undefined): Promise<boolean> {
  if (!expectedHash || code.trim() === "") return false;
  return (await ownerCodeHashOf(code)) === expectedHash;
}

/** Why a code cannot be chosen as the owner's, in words for the one choosing, or null when it can. */
export function ownerCodeProblem(code: string): string | null {
  const length = code.trim().length;
  if (length === 0) return null;
  return length < MIN_OWNER_CODE_LENGTH ? `Koden må ha minst ${MIN_OWNER_CODE_LENGTH} tegn. Den har ${length}.` : null;
}
