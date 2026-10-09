import { addressAfterSwitch, parseDemoSiteId, siteInAddress } from "../utils/demoSite";
import { isPublicPath } from "../utils/routes";

// The congregation a visitor of the demo has chosen to look at (see utils/demoSite.ts). It is
// kept in the visitor's own browser, like the level (demoLevel.ts). Unlike the level it is read
// once, when the app is loaded: it decides which collections the app reads, so choosing another
// loads the app anew.

const KEY = "menighetsplan_demo_menighet";

function remember(site: string | null): void {
  try {
    if (site === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, site);
  } catch {
    // Blocked storage only means the choice is not remembered when the page is loaded again
  }
}

/**
 * The congregation the visitor has chosen, or null for the example congregation. An address
 * that names one (…/?menighet=sogne) is a choice too, and goes before an earlier one, so a link
 * from outside can lead straight to a congregation.
 */
export function readChosenDemoSite(): string | null {
  try {
    const asked = siteInAddress(window.location.search);
    if (asked !== undefined) {
      remember(asked);
      return asked;
    }
    return parseDemoSiteId(window.localStorage.getItem(KEY));
  } catch {
    // No browser, or one that blocks its storage: the example congregation
    return null;
  }
}

/** Remembers the choice and loads the app with that congregation. */
export function chooseDemoSite(site: string | null, go: (address: string) => void = (address) => window.location.assign(address)): void {
  remember(site);
  const { pathname, search } = window.location;
  go(addressAfterSwitch(pathname, search, isPublicPath(pathname)));
}
