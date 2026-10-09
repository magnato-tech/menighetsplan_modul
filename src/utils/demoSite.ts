// The congregations a visitor of the demo can choose to look at.
//
// The demo's database holds the example congregation, and beside it one copy for each
// congregation whose website has been made into a set (public/demosett/): that congregation's
// website, with the example congregation's planner. A visitor chooses which one to look at, and
// the choice is theirs alone: it lies in their browser, and decides which collections the app
// reads and writes (see data/collections.ts). No visitor changes what another sees.
//
// A congregation is named by the id of its set ("sogne"), and the example congregation by null.

/** What the address says to go straight to one congregation: demo.example/?menighet=sogne */
export const SITE_PARAMETER = "menighet";
/** The word for the example congregation in an address. */
const EXAMPLE_IN_ADDRESS = "eksempel";

// The id becomes part of the names of collections, so it can be nothing but plain letters and digits
const SITE_ID = /^[a-z0-9]{1,24}$/;

/** The congregation a stored or given value names, or null when it names none. */
export function parseDemoSiteId(value: unknown): string | null {
  return typeof value === "string" && SITE_ID.test(value) ? value : null;
}

/** What stands in front of the name of every collection a congregation in the demo has. Nothing for the example congregation. */
export const collectionPrefixOf = (site: string | null): string => (site ? `${site}-` : "");

/**
 * The congregation an address asks for: an id, null for the example congregation, or undefined
 * when the address asks for none (and the visitor's earlier choice stands).
 */
export function siteInAddress(search: string): string | null | undefined {
  const asked = new URLSearchParams(search).get(SITE_PARAMETER);
  if (asked === null) return undefined;
  if (asked === EXAMPLE_IN_ADDRESS) return null;
  return parseDemoSiteId(asked) ?? undefined;
}

/**
 * Where the visitor is taken when another congregation is chosen. A page on the website belongs
 * to the congregation that was shown, so the visitor starts on the front page of the new one.
 * The admin and Min side are the same screens for all of them, and are kept.
 */
export function addressAfterSwitch(pathname: string, search: string, isPublicPage: boolean): string {
  if (isPublicPage) return "/";
  const parameters = new URLSearchParams(search);
  parameters.delete(SITE_PARAMETER);
  const rest = parameters.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
