import React from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../context/FirebaseDataContext";
import { DEMO } from "../demo";
import { SIGN_IN_PATH } from "../utils/routes";
import { useLevel } from "../hooks/useLevel";
import { chooseDemoLevel } from "../services/demoLevel";
import { LEVELS, LEVEL_NAMES, LEVEL_SUMMARIES } from "../utils/level";

const link = "font-bold whitespace-nowrap underline underline-offset-2 decoration-slate-500 hover:text-white hover:decoration-white";

/** The name of the website an address leads to, as a visitor would say it. */
const siteName = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

/**
 * The strip at the top of the demo installation: it says that this is a demo, lets the visitor
 * choose which of the two levels to look at, shows the way in to Min side and the admin, and
 * leads to the sign-up and back to the website that presents the product. A congregation's own
 * installation never draws it.
 *
 * It stays at the top of the screen. Its height is set in index.css (--demo-strip), and what
 * else is pinned to the top, is pinned below it.
 */
export const DemoStrip: React.FC = () => {
  const level = useLevel();
  const { session } = useFirebase();
  if (!DEMO) return null;

  return (
    <aside
      aria-label="Demo"
      className="sticky top-0 z-[45] h-[var(--demo-strip)] overflow-hidden bg-slate-950 text-slate-300 border-b border-slate-800 px-3 py-1.5 text-[11px] flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-1.5"
    >
      <p className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">Demo</span>
        <span className="hidden sm:inline truncate">Alt du ser her, er eksempler.</span>
      </p>

      <div
        role="radiogroup"
        aria-label="Velg nivå"
        className="order-last md:order-none basis-full md:basis-auto flex rounded-lg bg-slate-800 p-0.5"
      >
        {LEVELS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={level === option}
            title={LEVEL_SUMMARIES[option]}
            onClick={() => chooseDemoLevel(option)}
            className={`flex-1 md:flex-none px-3 py-1 rounded-md font-bold whitespace-nowrap cursor-pointer transition-colors ${
              level === option ? "bg-white text-slate-950 shadow-xs" : "text-slate-300 hover:text-white"
            }`}
          >
            {LEVEL_NAMES[option]}
          </button>
        ))}
      </div>

      <p className="md:flex-1 flex items-center justify-end gap-3">
        {/* The way in (pages/DemoDoor.tsx), for a visitor who is not inside already */}
        {session.status !== "member" && (
          <Link to={SIGN_IN_PATH} className="px-2 py-0.5 rounded-md bg-white text-slate-950 font-bold whitespace-nowrap hover:bg-slate-200">
            Gå inn <span className="hidden lg:inline">på Min side og admin</span>
          </Link>
        )}
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
