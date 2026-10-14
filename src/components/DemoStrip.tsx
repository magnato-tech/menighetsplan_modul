import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../context/FirebaseDataContext";
import { DEMO } from "../demo";
import { DEMO_SITE } from "../demoSite";
import { chooseDemoSite } from "../services/demoSite";
import { useDemoSites } from "../hooks/useDemoSites";
import { SIGN_IN_PATH } from "../utils/routes";
import { forgetDemoLevel, readDemoLevel } from "../services/demoLevel";

const link = "font-bold whitespace-nowrap underline underline-offset-2 decoration-slate-500 hover:text-white hover:decoration-white";

/** Said where the visitor chooses a congregation: what the choice is for. */
const SITE_CHOICE_HINT = "Se med ett klikk hvordan løsningen ser ut for din menighet";

/** The name of the website an address leads to, as a visitor would say it. */
const siteName = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

/**
 * The strip at the top of the demo installation: it says that this is a demo, lets the visitor
 * choose which congregation to look at, shows the way in to Min side
 * and the admin, and leads to the sign-up and back to the website that presents the product. A
 * congregation's own installation never draws it.
 *
 * It stays at the top of the screen. Its height is set in index.css (--demo-strip), and what
 * else is pinned to the top, is pinned below it.
 */
export const DemoStrip: React.FC = () => {
  // The choice between the two levels is out of the strip for now (decided 14 October 2026): so far
  // the levels differ only in parts of the admin, and the choice looked like it did nothing. The demo
  // shows the whole product, and a level chosen before is forgotten. The levels stay in the code
  // (utils/level.ts, services/demoLevel.ts) for the day a congregation wants only the website.
  useEffect(() => {
    if (DEMO && readDemoLevel()) forgetDemoLevel();
  }, []);
  const { session } = useFirebase();
  const sites = useDemoSites();
  if (!DEMO) return null;
  const shown = sites.find((site) => site.id === DEMO_SITE);

  return (
    <aside
      aria-label="Demo"
      className="sticky top-0 z-[45] h-[var(--demo-strip)] overflow-hidden bg-slate-950 text-slate-300 border-b border-slate-800 px-3 py-1.5 text-[11px] flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-1.5"
    >
      <p className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">Demo</span>
        <span className="hidden sm:inline truncate">
          {shown ? `Nettsiden er hentet fra ${shown.source} for å vise løsningen.` : "Alt du ser her, er eksempler."}
        </span>
      </p>

      <div className="order-last md:order-none basis-full md:basis-auto min-w-0 flex items-center gap-2">
        {/* Only when a congregation lies ready in the demo's database (services/demoSiteList.ts) */}
        {sites.length > 0 && (
          <label className="min-w-0 flex-1 md:flex-none flex items-center gap-1.5" title={SITE_CHOICE_HINT}>
            <span className="hidden xl:inline whitespace-nowrap text-amber-300 font-bold">Se din menighet</span>
            <select
              aria-label="Velg menighet"
              value={DEMO_SITE ?? ""}
              onChange={(event) => chooseDemoSite(event.target.value || null)}
              className="min-w-0 w-full md:w-auto md:max-w-[13rem] rounded-md bg-slate-800 text-white font-bold px-2 py-1 border border-slate-600 cursor-pointer truncate"
            >
              <option value="">Eksempelmenighet</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
        )}

      </div>

      <p className="md:flex-1 flex items-center justify-end gap-3">
        {/* The ways in (pages/DemoDoor.tsx). Someone who is inside goes there to choose another. */}
        <Link to={SIGN_IN_PATH} className="px-2 py-0.5 rounded-md bg-white text-slate-950 font-bold whitespace-nowrap hover:bg-slate-200">
          {session.status === "member" ? (
            "Bytt rolle"
          ) : (
            <>
              Gå inn <span className="hidden lg:inline">i CMS, admin og Min side</span>
            </>
          )}
        </Link>
        {DEMO.signUpUrl && (
          <a href={DEMO.signUpUrl} className={`${link} text-amber-300`}>
            Kom i gang
          </a>
        )}
        {DEMO.salesSiteUrl && (
          <a href={DEMO.salesSiteUrl} className={link}>
            <span className="hidden sm:inline">Tilbake til</span> {siteName(DEMO.salesSiteUrl)}
          </a>
        )}
      </p>
    </aside>
  );
};

/**
 * Puts the strip above the app in the demo installation, and nothing anywhere else. A page
 * shown inside another, as the preview in the admin is, has no strip of its own.
 */
export const DemoFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const embedded = typeof window !== "undefined" && window.parent !== window;
  if (!DEMO || embedded) return <>{children}</>;
  return (
    <div className="demo-frame">
      <DemoStrip />
      {children}
    </div>
  );
};
