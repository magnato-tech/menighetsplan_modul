import React, { useState } from "react";
import { AlertTriangle, Puzzle } from "lucide-react";
import { useCms } from "../../../context/CmsContext";
import { countAddonsOn, isAddonOn, type AddonId } from "../../../utils/addons";
import { BUILT_MODULES, PLANNED_MODULES, STUDIO_ADDONS, moduleName, type StudioAddon } from "../addons";
import type { ShowFeedback, StudioTab } from "../studio";
import { studioCard } from "../studioTheme";
import { AddonCard } from "./addons/AddonCard";
import { MinSideModules } from "./addons/MinSideModules";

interface AddonsTabProps {
  showFeedback: ShowFeedback;
  onTabChange: (tab: StudioTab) => void;
}

const sectionHeading = "text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]";

/** Moduler: the parts of the admin a congregation turns on when it wants them, each with its switch. */
export const AddonsTab: React.FC<AddonsTabProps> = ({ showFeedback, onTabChange }) => {
  const { addons, addonsState, setAddon } = useCms();
  const [saving, setSaving] = useState<AddonId | null>(null);

  const toggle = async (addon: StudioAddon, on: boolean) => {
    setSaving(addon.id);
    const saved = await setAddon(addon.id, on);
    setSaving(null);
    // A choice that did not reach the database is already reported where every failed save is
    if (!saved) return;
    showFeedback(
      on
        ? `«${addon.name}» er slått på. Du finner den i menyen under ${moduleName(addon.module)}.`
        : `«${addon.name}» er slått av og tatt ut av menyen. Ingenting er slettet.`
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--studio-border)] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--studio-text)] tracking-tight flex items-center gap-2.5">
            <Puzzle className="w-6 h-6 text-[var(--studio-icon)]" aria-hidden="true" />
            Moduler
          </h1>
          <p className="text-xs sm:text-sm text-[var(--studio-muted)] mt-1 max-w-2xl">
            Moduler er deler av admin som dere slår på når dere trenger dem. En modul som er på, får sin egen plass i menyen. Valget
            gjelder for alle som bruker admin.
          </p>
        </div>
        {addonsState === "ready" && (
          <p className="self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-full bg-[var(--studio-surface)] border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)] tabular-nums">
            {countAddonsOn(addons)} av {STUDIO_ADDONS.length} er på
          </p>
        )}
      </div>

      {addonsState === "loading" && <p className="text-sm text-[var(--studio-muted)]">Henter modulene …</p>}

      {addonsState === "failed" && (
        <p role="alert" className={`${studioCard} p-4 flex items-start gap-2.5 text-xs text-[var(--studio-text)]`}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-500" aria-hidden="true" />
          <span>Det kunne ikke hentes hvilke moduler som er slått på, så ingen av dem vises. Last siden på nytt for å prøve igjen.</span>
        </p>
      )}

      {addonsState === "ready" &&
        BUILT_MODULES.map((module) => (
          <section key={module.id} aria-label={module.name} className="space-y-3">
            <h2 className={sectionHeading}>{module.name}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {module.addons.map((addon) => (
                <AddonCard
                  key={addon.id}
                  addon={addon}
                  on={isAddonOn(addons, addon.id)}
                  saving={saving === addon.id}
                  onToggle={(on) => toggle(addon, on)}
                  onOpen={onTabChange}
                />
              ))}
            </div>
          </section>
        ))}

      <MinSideModules showFeedback={showFeedback} />

      <section aria-label="Planlagte moduler" className="space-y-3">
        <h2 className={sectionHeading}>Planlagt</h2>
        <div className={`${studioCard} p-4 space-y-3`}>
          <ul className="flex flex-wrap gap-2">
            {PLANNED_MODULES.map((module) => (
              <li
                key={module.id}
                className="px-3 py-1.5 rounded-full border border-dashed border-[var(--studio-border)] text-xs font-bold text-[var(--studio-muted)]"
              >
                {module.name}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[var(--studio-muted)]">Ikke laget ennå. Hver av dem får sin egen bryter her når den er klar.</p>
        </div>
      </section>
    </div>
  );
};
