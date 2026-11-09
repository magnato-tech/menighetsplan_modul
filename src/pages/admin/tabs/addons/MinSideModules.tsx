import React, { useState } from "react";
import { useCms } from "../../../../context/CmsContext";
import { isMinSideModuleOn, MIN_SIDE_MODULE_IDS, MIN_SIDE_MODULE_REQUIRES, type MinSideModuleId } from "../../../../utils/minSideModules";
import { MIN_SIDE_MODULE_TEXT, requiresText } from "../../minSideModules";
import { studioCard } from "../../studioTheme";
import type { ShowFeedback } from "../../studio";
import { AddonSwitch } from "./AddonSwitch";

interface MinSideModulesProps {
  showFeedback: ShowFeedback;
}

/**
 * The parts of Min side that can be switched off. A module whose required module is off shows
 * its switch disabled, and its state is the one that counts (a part of a switched off group is off).
 */
export const MinSideModules: React.FC<MinSideModulesProps> = ({ showFeedback }) => {
  const { minSideModules, setMinSideModule } = useCms();
  const [saving, setSaving] = useState<MinSideModuleId | null>(null);

  const toggle = async (id: MinSideModuleId, on: boolean) => {
    const { name } = MIN_SIDE_MODULE_TEXT[id];
    setSaving(id);
    const saved = await setMinSideModule(id, on);
    setSaving(null);
    // A choice that did not reach the database is already reported where every failed save is
    if (!saved) return;
    showFeedback(on ? `«${name}» er slått på.` : `«${name}» er slått av. Ingenting er slettet.`);
  };

  return (
    <section aria-label="Min side" className="space-y-3">
      <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Min side</h2>
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MIN_SIDE_MODULE_IDS.map((id) => {
          const text = MIN_SIDE_MODULE_TEXT[id];
          const on = isMinSideModuleOn(minSideModules, id);
          const required = MIN_SIDE_MODULE_REQUIRES[id];
          const requiredOn = required ? isMinSideModuleOn(minSideModules, required) : true;
          return (
            <li key={id} className={`${studioCard} p-5 flex flex-col gap-3 transition-colors ${on ? "border-emerald-600/60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-[var(--studio-text)]">{text.name}</h3>
                  <p className="text-xs text-[var(--studio-muted)] mt-1">{text.summary}</p>
                </div>
                <AddonSwitch
                  on={on}
                  label={text.name}
                  disabled={saving === id || !requiredOn}
                  onChange={(next) => toggle(id, next)}
                />
              </div>
              <div className="mt-auto pt-3 border-t border-[var(--studio-border)] space-y-1">
                {!requiredOn && <p className="text-[11px] font-bold text-[var(--studio-text)]">{requiresText(id)}</p>}
                <p className="text-[11px] text-[var(--studio-muted)]">{on ? "På." : text.whenOff}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
