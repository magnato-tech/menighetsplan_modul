// The personal link in an e-mail that signs the one who gets it in: /lenke, with the address to go
// to after signing in, and the token in the fragment. A fragment is never sent to the server in a
// request, nor in a Referer, so the token stays out of the server's logs. The token is made and
// checked on the server (server/loginLinkToken.ts). Here is only what both sides agree on.

/** How long a login link works. */
export const LOGIN_LINK_DAYS = 14;

/** The page the link opens. Not behind sign-in: the token is the proof. */
export const LOGIN_LINK_PATH = "/lenke";

const DESTINATION_MAX = 300;
const FALLBACK_DESTINATION = "/minside";

/**
 * Where to go after the link has signed someone in: an address in the app, given as a path. Anything
 * else, such as an address on another website, is answered with Min side.
 */
export function safeDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > DESTINATION_MAX) return FALLBACK_DESTINATION;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return FALLBACK_DESTINATION;
  return value;
}

/** The address of a login link: the installation's address, the page, the destination and the token. */
export function loginLinkUrl(siteUrl: string, destinationPath: string, token: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${LOGIN_LINK_PATH}?til=${encodeURIComponent(destinationPath)}#${token}`;
}
