import { useEffect, useState } from "react";
import { DEMO } from "../demo";
import { DEMO_SITE } from "../demoSite";
import { chooseDemoSite } from "../services/demoSite";
import { listDemoSites, type DemoSiteChoice } from "../services/demoSiteList";

/**
 * The congregations a visitor of the demo can choose between, apart from the example
 * congregation. None until the list has arrived, and never any outside the demo.
 *
 * A visitor whose choice is not among them (a set that has been taken out, or a link that names
 * a congregation the demo does not have) is taken to the example congregation.
 */
export function useDemoSites(): DemoSiteChoice[] {
  const [sites, setSites] = useState<DemoSiteChoice[]>([]);

  useEffect(() => {
    if (!DEMO) return;
    let stopped = false;
    listDemoSites().then((list) => {
      // Without a list nothing is known, and nothing is offered or changed
      if (stopped || list === null) return;
      if (DEMO_SITE !== null && !list.some((site) => site.id === DEMO_SITE)) chooseDemoSite(null);
      else setSites(list);
    });
    return () => {
      stopped = true;
    };
  }, []);

  return sites;
}
