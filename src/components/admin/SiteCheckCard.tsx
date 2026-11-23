import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import type { StudioTab } from "../../pages/admin/studio";
import type { Gathering } from "../../types";
import { siteCheck, type SiteCheckFinding, type SiteCheckInput } from "../../utils/siteCheck";
import { GatheringWebsiteDialog } from "../gathering/GatheringWebsiteDialog";

/** How many findings are shown before «Vis alle». */
const FIRST = 6;

/** The findings put aside with «Ikke nå», by their key. Kept in this browser only. */
const PUT_ASIDE_KEY = "menighetsplan:sjekk-ikke-naa";

function readPutAside(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PUT_ASIDE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writePutAside(keys: string[]): void {
  try {
    window.localStorage.setItem(PUT_ASIDE_KEY, JSON.stringify(keys));
  } catch {
    // Without storage the choice lasts until the page is left
  }
}

/**
 * «Sjekk nettsiden»: what is missing or wrong across the website, each with the tab that mends it. On the
 * website part's overview, so it is seen without opening every page. A line can be put aside with «Ikke nå».
 */
export const SiteCheckCard: React.FC<SiteCheckInput & {
  onTabChange: (tab: StudioTab) => void;
  /** Stores the website part of an event. The answer says whether it went well. */
  onSaveGathering: (id: string, updates: Partial<Gathering>) => { success: boolean; error?: string };
}> = ({ onTabChange, onSaveGathering, ...input }) => {
  const findings = useMemo(() => siteCheck(input), [input.pages, input.news, input.gatherings, input.media, input.now]);
  const { gatherings } = input;
  const [all, setAll] = useState(false);
  const [putAside, setPutAsideKeys] = useState<string[]>(readPutAside);
  const [showPutAside, setShowPutAside] = useState(false);
  const [website, setWebsite] = useState<{ gathering: Gathering; others: string[] } | null>(null);

  const putAsideSet = new Set(putAside);
  const visible = findings.filter((finding) => !putAsideSet.has(finding.key));
  const hiddenCount = findings.length - visible.length;
  const base = showPutAside ? findings : visible;
  const shown = all ? base : base.slice(0, FIRST);

  const setPutAside = (key: string, on: boolean) => {
    const next = on ? [...putAside.filter((item) => item !== key), key] : putAside.filter((item) => item !== key);
    setPutAsideKeys(next);
    writePutAside(next);
  };

  const openWebsite = (finding: SiteCheckFinding) => {
    const ids = finding.gatheringIds ?? [];
    const gathering = gatherings.find((item) => item.id === ids[0]);
    if (gathering) setWebsite({ gathering, others: ids.slice(1) });
  };

  return (
    <section data-site-check className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[var(--studio-icon)] font-bold text-sm">
          <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
          <span>Sjekk nettsiden</span>
        </h2>
        <span className="text-[11px] text-[var(--studio-muted)]">
          {visible.length === 0 ? "Ingenting å rette" : visible.length === 1 ? "1 ting å se på" : `${visible.length} ting å se på`}
        </span>
      </div>

      {findings.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          Alle sidene har beskrivelse, bildene har tekst for skjermleser, lenkene virker, og nyhetene og arrangementene er i orden.
        </p>
      ) : (
        <>
          {visible.length === 0 && !showPutAside && <p className="text-xs text-[var(--studio-text)]">Ingenting annet å se på akkurat nå.</p>}
          <ul className="space-y-1.5">
            {shown.map((finding) => {
              const isPutAside = putAsideSet.has(finding.key);
              const isEvent = finding.kind === "eventMissing" && (finding.gatheringIds?.length ?? 0) > 0;
              const isGroup = (finding.gatheringIds?.length ?? 0) > 1;
              const info = (
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--studio-text)] truncate">{finding.where}</span>
                  <span className="block text-[11px] text-[var(--studio-muted)]">{finding.what}</span>
                </span>
              );
              return (
                <li key={finding.key} className={`flex items-center gap-2 rounded-xl bg-[var(--studio-bg)] ${isPutAside ? "opacity-60" : ""}`}>
                  {isEvent ? (
                    <div className="min-w-0 flex-1 px-3 py-2">{info}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onTabChange(finding.tab)}
                      className="min-w-0 flex-1 flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-[var(--studio-hover)] text-left cursor-pointer"
                    >
                      {info}
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[var(--studio-icon)]" aria-hidden="true" />
                    </button>
                  )}
                  {isEvent && (
                    <button
                      type="button"
                      onClick={() => openWebsite(finding)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
                    >
                      {isGroup ? "Bilde og tekst på alle" : "Bilde og tekst"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPutAside(finding.key, !isPutAside)}
                    className="shrink-0 mr-2 px-2.5 py-1 rounded-lg border border-[var(--studio-border)] text-[11px] font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer"
                  >
                    {isPutAside ? "Ta tilbake" : "Ikke nå"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {hiddenCount > 0 && (
        <p className="text-[11px] text-[var(--studio-muted)]">
          {hiddenCount} ting er satt til «Ikke nå» ·{" "}
          <button type="button" onClick={() => setShowPutAside((value) => !value)} className="font-semibold text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] cursor-pointer">
            {showPutAside ? "Skjul" : "Vis"}
          </button>
        </p>
      )}

      {base.length > FIRST && (
        <button type="button" onClick={() => setAll((value) => !value)} className="text-[11px] font-semibold text-[var(--studio-accent-text)] hover:text-[var(--studio-text)] cursor-pointer">
          {all ? "Vis færre" : `Vis alle ${base.length}`}
        </button>
      )}

      {website && (
        <GatheringWebsiteDialog
          gathering={website.gathering}
          onSave={(updates) => onSaveGathering(website.gathering.id, updates)}
          alsoFor={
            website.others.length > 0
              ? {
                  count: website.others.length,
                  onSaveAll: (updates) => {
                    for (const id of website.others) onSaveGathering(id, updates);
                  },
                }
              : undefined
          }
          onClose={() => setWebsite(null)}
        />
      )}
    </section>
  );
};
