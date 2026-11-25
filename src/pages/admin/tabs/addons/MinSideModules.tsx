import React, { useState } from "react";
import { useCms } from "../../../../context/CmsContext";
import { groupAudienceOf, GROUP_AUDIENCES, isMinSideModuleOn, MIN_SIDE_MODULE_IDS, MIN_SIDE_MODULE_REQUIRES, type GroupAudience, type MinSideModuleId } from "../../../../utils/minSideModules";
import { GROUP_AUDIENCE_TEXT, MIN_SIDE_MODULE_TEXT, requiresText } from "../../minSideModules";
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
  const { minSideModules, setMinSideModule, setGroupAudience } = useCms();
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

  const chooseAudience = async (audience: GroupAudience) => {
    setSaving("grupper");
    const saved = await setGroupAudience(audience);
    setSaving(null);
    if (!saved) return;
    showFeedback(
      audience === "alle"
        ? "Gruppene vises for alle."
        : audience === "ledere"
        ? "Gruppene vises nå bare for gruppeledere. Ingenting er slettet."
        : "Gruppene vises ikke på Min side. Ingenting er slettet."
    );
  };
  const audience = groupAudienceOf(minSideModules);

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
                {id !== "grupper" && (
                  <AddonSwitch
                    on={on}
                    label={text.name}
                    disabled={saving === id || !requiredOn}
                    onChange={(next) => toggle(id, next)}
                  />
                )}
              </div>
              {id === "grupper" && (
                <div role="radiogroup" aria-label="Hvem gruppene vises for" className="flex flex-wrap gap-1.5">
                  {GROUP_AUDIENCES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={audience === choice}
                      disabled={saving === id}
                      onClick={() => audience !== choice && chooseAudience(choice)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors disabled:opacity-60 ${
                        audience === choice
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-[var(--studio-surface,white)] text-[var(--studio-text)] border-[var(--studio-border)] hover:bg-slate-50"
                      }`}
                    >
                      {GROUP_AUDIENCE_TEXT[choice].label}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-auto pt-3 border-t border-[var(--studio-border)] space-y-1">
                {!requiredOn && <p className="text-[11px] font-bold text-[var(--studio-text)]">{requiresText(id)}</p>}
                <p className="text-[11px] text-[var(--studio-muted)]">
                  {id === "grupper" ? GROUP_AUDIENCE_TEXT[audience].description : on ? "På." : text.whenOff}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
