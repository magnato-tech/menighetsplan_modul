import { useEffect, useState } from "react";
import { DEMO } from "../demo";
import { DEMO_SITE } from "../demoSite";
import { chooseDemoSite } from "../services/demoSite";
import { listDemoSites, type DemoSiteChoice } from "../services/demoSiteList";

/**
 * The congregations a visitor of the demo can choose between, apart from the example
 * congregation: the ones the owner has put in the list, and the one the visitor is looking at
 * (opened with a link) if it is not among them. None until the list has arrived, and never any
 * outside the demo.
 *
 * A visitor whose congregation the demo does not have (a set that has been taken out, or a link
 * that names one that is not there) is taken to the example congregation.
 */
export function useDemoSites(): DemoSiteChoice[] {
  const [sites, setSites] = useState<DemoSiteChoice[]>([]);

  useEffect(() => {
    if (!DEMO) return;
    let stopped = false;
    listDemoSites().then((ready) => {
      // Without a list nothing is known, and nothing is offered or changed
      if (stopped || ready === null) return;
      if (DEMO_SITE !== null && !ready.some((site) => site.id === DEMO_SITE)) chooseDemoSite(null);
      else setSites(ready.filter((site) => site.listed || site.id === DEMO_SITE));
    });
    return () => {
      stopped = true;
    };
  }, []);

  return sites;
}
