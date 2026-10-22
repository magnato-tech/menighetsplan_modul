import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import type { StudioTab } from "../../pages/admin/studio";
import { siteCheck, type SiteCheckInput } from "../../utils/siteCheck";

/** How many findings are shown before «Vis alle». */
const FIRST = 6;

/**
 * «Sjekk nettsiden»: what is missing or wrong across the website, each with the tab that mends it. On the
 * website part's overview, so it is seen without opening every page.
 */
export const SiteCheckCard: React.FC<SiteCheckInput & { onTabChange: (tab: StudioTab) => void }> = ({ onTabChange, ...input }) => {
  const findings = useMemo(() => siteCheck(input), [input.pages, input.news, input.gatherings, input.media, input.now]);
  const [all, setAll] = useState(false);
  const shown = all ? findings : findings.slice(0, FIRST);

  return (
    <section data-site-check className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[var(--studio-icon)] font-bold text-sm">
          <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
          <span>Sjekk nettsiden</span>
        </h2>
        <span className="text-[11px] text-[var(--studio-muted)]">
          {findings.length === 0 ? "Ingenting å rette" : findings.length === 1 ? "1 ting å se på" : `${findings.length} ting å se på`}
        </span>
      </div>

      {findings.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          Alle sidene har beskrivelse, bildene har tekst for skjermleser, lenkene virker, og nyhetene og arrangementene er i orden.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((finding, index) => (
            <li key={`${finding.kind}-${finding.where}-${index}`}>
              <button
                type="button"
                onClick={() => onTabChange(finding.tab)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-left cursor-pointer"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--studio-text)] truncate">{finding.where}</span>
                  <span className="block text-[11px] text-[var(--studio-muted)]">{finding.what}</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[var(--studio-icon)]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {findings.length > FIRST && (
        <button type="button" onClick={() => setAll((value) => !value)} className="text-[11px] font-semibold text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] cursor-pointer">
          {all ? "Vis færre" : `Vis alle ${findings.length}`}
        </button>
      )}
    </section>
  );
};
