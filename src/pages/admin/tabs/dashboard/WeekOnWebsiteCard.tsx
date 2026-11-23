import React, { useState } from "react";
import { Globe } from "lucide-react";
import type { CmsNewsArticle, CmsPage } from "../../../../data/cmsData";
import type { Gathering } from "../../../../types";
import { GatheringWebsiteDialog } from "../../../../components/gathering/GatheringWebsiteDialog";
import { lastEditedText } from "../../../../utils/lastEdited";
import { missingThisWeek, newsThisWeek, recentChanges, shortDate, shortDateOfDay, shortDateTime, weekOf } from "../../../../utils/weekOnWebsite";
import type { StudioTab } from "../../studio";

interface WeekOnWebsiteCardProps {
  pages: CmsPage[];
  news: CmsNewsArticle[];
  gatherings: Gathering[];
  /** The persons in this tab, to name who saved a page or an article. */
  nameOf: (personId: string) => string | undefined;
  now: number;
  onTabChange: (tab: StudioTab) => void;
  /** Stores the presentation of an event, as «Sjekk nettsiden» does. */
  onSaveGathering: (id: string, updates: Partial<Gathering>) => { success: boolean; error?: string };
  /** Inside the panel on a phone: no outer box and no heading, the panel has the title. */
  inPanel?: boolean;
}

const COLUMN_TITLE = "text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider flex items-center justify-between gap-2";
const ROW = "w-full text-left p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 transition-colors cursor-pointer min-w-0";
const EMPTY = "text-xs text-[var(--studio-muted)] p-3";

/** «Denne uka på nettsiden»: what is missing before Sunday, what is published or ends this week, and what changed last. */
export const WeekOnWebsiteCard: React.FC<WeekOnWebsiteCardProps> = ({ pages, news, gatherings, nameOf, now, onTabChange, onSaveGathering, inPanel = false }) => {
  const [editing, setEditing] = useState<Gathering | null>(null);
  const week = weekOf(now);
  const events = missingThisWeek(gatherings, now);
  const eventsMissing = events.filter((item) => item.missing.length > 0).length;
  const { publishing, expiring } = newsThisWeek(news, gatherings, now);
  const changes = recentChanges(pages, news, now, 5);

  const content = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {inPanel ? null : (
          <h2 id="denne-uka-paa-nettsiden" className="flex items-center gap-2 text-[var(--studio-icon)] font-bold text-sm">
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span>Denne uka på nettsiden</span>
          </h2>
        )}
        <span className="text-xs text-[var(--studio-muted)]">{week.label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Events that miss something on the website before Sunday */}
        <div className="space-y-2 min-w-0">
          <h3 className={COLUMN_TITLE}>
            <span>Mangler før søndag</span>
            <span className="text-[var(--studio-text)] text-sm">{eventsMissing}</span>
          </h3>
          {events.length === 0 && <p className={EMPTY}>Ingenting mangler denne uka.</p>}
          {events.map((item) => {
            const missing = item.missing.length > 0;
            const body = (
              <>
                <span className="block text-xs font-semibold text-[var(--studio-text)] truncate">
                  {item.gathering.title} · {shortDate(item.start)}
                </span>
                <span className={`block text-[11px] ${missing ? "text-amber-400" : "text-emerald-400"}`}>
                  {missing ? `Mangler ${item.missing.join(" og ")}` : "Klar: bilde og tekst er på plass"}
                </span>
              </>
            );
            return (
              <div key={item.gathering.id}>
                {missing ? (
                  <button type="button" onClick={() => setEditing(item.gathering)} className={ROW}>
                    {body}
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--studio-bg)] min-w-0">{body}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* News published later this week, and news whose last day is this week */}
        <div className="space-y-4 min-w-0">
          <div className="space-y-2">
            <h3 className={COLUMN_TITLE}>
              <span>Publiseres</span>
              <span className="text-[var(--studio-text)] text-sm">{publishing.length}</span>
            </h3>
            {publishing.length === 0 && <p className={EMPTY}>Ingenting planlagt denne uka.</p>}
            {publishing.map((item) => (
              <button key={item.news.id} type="button" onClick={() => onTabChange("cms-nyheter")} className={ROW}>
                <span className="block text-xs font-semibold text-[var(--studio-text)] truncate">{item.news.title}</span>
                <span className="block text-[11px] text-[var(--studio-muted)]">Nyhet · planlagt {shortDateTime(item.at)}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className={COLUMN_TITLE}>
              <span>Går ut</span>
              <span className="text-[var(--studio-text)] text-sm">{expiring.length}</span>
            </h3>
            {expiring.length === 0 && <p className={EMPTY}>Ingenting går ut denne uka.</p>}
            {expiring.map((item) => (
              <button key={item.news.id} type="button" onClick={() => onTabChange("cms-nyheter")} className={ROW}>
                <span className="block text-xs font-semibold text-[var(--studio-text)] truncate">{item.news.title}</span>
                <span className="block text-[11px] text-[var(--studio-muted)]">Nyhet · siste dag {shortDateOfDay(item.day)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* The latest saved pages and news */}
        <div className="space-y-2 min-w-0">
          <h3 className={COLUMN_TITLE}>
            <span>Sist endret</span>
          </h3>
          {changes.length === 0 && <p className={EMPTY}>Ingen endringer ennå.</p>}
          {changes.map((change) => {
            const edited = lastEditedText(change, nameOf, now, { withTime: true });
            return (
              <button
                key={`${change.kind}-${change.title}-${change.updatedAt}`}
                type="button"
                onClick={() => onTabChange(change.kind === "side" ? "cms-sider" : "cms-nyheter")}
                className={ROW}
              >
                <span className="block text-xs font-semibold text-[var(--studio-text)] truncate">{change.title}</span>
                <span className="block text-[11px] text-[var(--studio-muted)]">
                  {change.kind === "side" ? "Side" : "Nyhet"}
                  {edited ? ` · ${edited}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {editing && (
        <GatheringWebsiteDialog
          gathering={editing}
          onSave={(updates) => onSaveGathering(editing.id, updates)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );

  if (inPanel) return <div className="space-y-4">{content}</div>;
  return (
    <section aria-labelledby="denne-uka-paa-nettsiden" className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
      {content}
    </section>
  );
};
