import { UNSUBSCRIBE_PATH } from "./newsletter";
import { LOGIN_LINK_PATH } from "./loginLink";

// Which part of the solution an address belongs to. The layout, the data that is loaded,
// and what search engines are told all follow from this, in the browser and on the server.

/** The sections of Min side. An internal address must start with one of these. */
export const MIN_SIDE_SECTIONS = [
  "/minside",
  "/leder",
  "/oppgave",
  "/gruppe",
  "/samling",
  "/husfellesskap",
  "/meldinger",
];

// Whole path segments only: "/leder" must not claim the public page "/lederskap"
const isUnder = (pathname: string, section: string) => pathname === section || pathname.startsWith(`${section}/`);

export { isAdminStudioPath } from "./adminStudioRoutes";

/** The page where one signs in. It is not part of the website visitors read, and not behind sign-in itself. */
export const SIGN_IN_PATH = "/logg-inn";

export function isSignInPath(pathname: string): boolean {
  return isUnder(pathname, SIGN_IN_PATH);
}

/** The page a TV in the church foyer shows: the open events of today, this week and what is coming. Not part of the website, and not counted as a visit. */
export const INFO_SCREEN_PATH = "/skjerm";

export function isInfoScreenPath(pathname: string): boolean {
  return isUnder(pathname, INFO_SCREEN_PATH);
}

/** Where the link at the bottom of a newsletter leads (see utils/newsletter.ts). Not part of the website, and left out of search results. */
export function isUnsubscribePath(pathname: string): boolean {
  return isUnder(pathname, UNSUBSCRIBE_PATH);
}

/** Where the link in an e-mail signs one in (see utils/loginLink.ts). Not part of the website, and not behind sign-in. */
export function isLoginLinkPath(pathname: string): boolean {
  return isUnder(pathname, LOGIN_LINK_PATH);
}

export function isMinSidePath(pathname: string): boolean {
  return MIN_SIDE_SECTIONS.some((section) => isUnder(pathname, section));
}

/** Whether the address is part of the website visitors see, and not of Min side, admin or the API. */
export function isPublicPath(pathname: string): boolean {
  return !isMinSidePath(pathname) && !isSignInPath(pathname) && !isUnsubscribePath(pathname) && !isLoginLinkPath(pathname) && !isInfoScreenPath(pathname) && !isUnder(pathname, "/admin") && !isUnder(pathname, "/api");
}
