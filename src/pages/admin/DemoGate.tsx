import React from "react";
import { EyeOff } from "lucide-react";
import { DEMO } from "../../demo";
import { isTabInDemo } from "./demoTabs";
import type { StudioTab } from "./studio";
import { studioCard } from "./studioTheme";

interface DemoGateProps {
  tab: StudioTab;
  children: React.ReactNode;
}

/**
 * In the demo, stops the tabs the demo is without (see demoTabs.ts). The menu does not lead to
 * them, but a typed address can. Everywhere else it lets every tab through.
 */
export const DemoGate: React.FC<DemoGateProps> = ({ tab, children }) => {
  if (!DEMO || isTabInDemo(tab)) return <>{children}</>;

  return (
    <div className={`${studioCard} max-w-xl mx-auto mt-8 p-8 text-center space-y-4`}>
      <span
        aria-hidden="true"
        className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--studio-row)] border border-[var(--studio-border)] text-[var(--studio-icon)]"
      >
        <EyeOff className="w-6 h-6" />
      </span>
      <h1 className="text-lg font-black text-[var(--studio-text)]">Ikke med i demoen</h1>
      <p className="text-xs text-[var(--studio-muted)]">
        Demoen deles av alle som ser på den. Derfor kan ikke databasen tømmes eller byttes ut herfra, og tilleggsmodulene vises ikke.
      </p>
    </div>
  );
};
