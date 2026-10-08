import React from "react";
import { Layers } from "lucide-react";
import { DEMO } from "../../demo";
import { useLevel } from "../../hooks/useLevel";
import { LEVEL_NAMES } from "../../utils/level";
import { isTabInLevel } from "./levelTabs";
import type { StudioTab } from "./studio";
import { studioCard } from "./studioTheme";

interface LevelGateProps {
  tab: StudioTab;
  children: React.ReactNode;
}

/**
 * Lets a tab through unless it belongs to the planner and the level does not have it. The menu
 * does not lead to such a tab, but an old link or a typed address can, and in the demo the
 * level can be changed while the tab is open. The tab is then not drawn at all.
 */
export const LevelGate: React.FC<LevelGateProps> = ({ tab, children }) => {
  const level = useLevel();
  if (isTabInLevel(tab, level)) return <>{children}</>;

  return (
    <div className={`${studioCard} max-w-xl mx-auto mt-8 p-8 text-center space-y-4`}>
      <span
        aria-hidden="true"
        className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--studio-row)] border border-[var(--studio-border)] text-[var(--studio-icon)]"
      >
        <Layers className="w-6 h-6" />
      </span>
      <h1 className="text-lg font-black text-[var(--studio-text)]">Dette hører til {LEVEL_NAMES.plan}</h1>
      <p className="text-xs text-[var(--studio-muted)]">
        Grupper, oppgaver, tjenesteroller og bemanning er en del av {LEVEL_NAMES.plan}. {LEVEL_NAMES.plattform} har nettsiden, kalenderen og en
        enkel Min side.
      </p>
      {DEMO && <p className="text-xs font-bold text-[var(--studio-text)]">Velg {LEVEL_NAMES.plan} i stripen øverst for å se det.</p>}
    </div>
  );
};
