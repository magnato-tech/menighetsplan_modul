import React from "react";
import { Link } from "react-router-dom";
import { Puzzle } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { isMinSideModuleOn } from "../../utils/minSideModules";
import { MIN_SIDE_ADMIN_TABS, MIN_SIDE_MODULE_TEXT } from "./minSideModules";
import { studioTabUrl, type StudioTab } from "./studio";
import { studioCard, studioPrimaryButton } from "./studioTheme";

interface MinSideModuleGateProps {
  tab: StudioTab;
  children: React.ReactNode;
}

/**
 * Lets a tab through unless it belongs to a Min side module that is off. The menu does not lead
 * to such a tab, but an old link or a typed address can. The tab is then not drawn at all.
 */
export const MinSideModuleGate: React.FC<MinSideModuleGateProps> = ({ tab, children }) => {
  const { minSideModules } = useCms();
  const id = MIN_SIDE_ADMIN_TABS[tab];
  if (!id || isMinSideModuleOn(minSideModules, id)) return <>{children}</>;

  const { name } = MIN_SIDE_MODULE_TEXT[id];
  return (
    <div className={`${studioCard} max-w-xl mx-auto mt-8 p-8 text-center space-y-4`}>
      <span
        aria-hidden="true"
        className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--studio-row)] border border-[var(--studio-border)] text-[var(--studio-icon)]"
      >
        <Puzzle className="w-6 h-6" />
      </span>
      <h1 className="text-lg font-black text-[var(--studio-text)]">{name} er slått av</h1>
      <p className="text-xs text-[var(--studio-muted)]">{name} er slått av under Moduler.</p>
      <Link to={studioTabUrl("moduler")} className={`${studioPrimaryButton} inline-flex items-center px-4 py-2 text-xs`}>
        Åpne Moduler
      </Link>
    </div>
  );
};
