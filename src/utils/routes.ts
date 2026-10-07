// Which part of the solution an address belongs to. The layout, the data that is loaded,
// and what search engines are told all follow from this, in the browser and on the server.

/** The sections of Min side. An internal address must start with one of these. */
export const MIN_SIDE_SECTIONS = ["/minside", "/leder", "/oppgave", "/gruppe", "/samling", "/husfellesskap", "/meldinger"];

// Whole path segments only: "/leder" must not claim the public page "/lederskap"
const isUnder = (pathname: string, section: string) => pathname === section || pathname.startsWith(`${section}/`);

export { isAdminStudioPath } from "./adminStudioRoutes";

/** The page where one signs in. It is not part of the website visitors read, and not behind sign-in itself. */
export const SIGN_IN_PATH = "/logg-inn";

export function isSignInPath(pathname: string): boolean {
  return isUnder(pathname, SIGN_IN_PATH);
}

export function isMinSidePath(pathname: string): boolean {
  return MIN_SIDE_SECTIONS.some((section) => isUnder(pathname, section));
}

/** Whether the address is part of the website visitors see, and not of Min side, admin or the API. */
export function isPublicPath(pathname: string): boolean {
  return !isMinSidePath(pathname) && !isSignInPath(pathname) && !isUnder(pathname, "/admin") && !isUnder(pathname, "/api");
}
