import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../../context/CmsContext";
import { CmsNewsArticle } from "../../../data/cmsData";
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  X,
  Newspaper,
  Clock,
  CalendarClock,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { formatNorwegianDateTime } from "../../../utils/dates";
import { isGroupGathering } from "../../../utils/gatherings";
import { isNewsExpired, lastDayOf, type LastDay } from "../../../utils/news";

/** A day ("2026-10-11") as it is written out: «11. oktober 2026». */
const writtenDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** How long an article is shown, said in a sentence. */
const shownUntil = (last: LastDay | null): string =>
  last === null
    ? "Står på nettsiden til du tar den ut."
    : last.from === "date"
      ? `Vises til og med ${writtenDay(last.day)}.`
      : `Vises til og med ${writtenDay(last.day)}, dagen for arrangementet.`;

interface NewsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
  /** Set when another tab asks for this one to open with a new, empty editor. */
  createRequested: boolean;
  onCreateHandled: () => void;
}

export const NewsTab: React.FC<NewsTabProps> = ({ studio, showFeedback, createRequested, onCreateHandled }) => {
  const { currentUser, adminGatherings } = studio;
  const { news, saveNews, deleteNews } = useCms();

  // The events an article can belong to: those open to the congregation that lie ahead, the nearest first
  const now = Date.now();
  const allEvents = adminGatherings.map((item) => item.gathering);
  const comingEvents = allEvents
    .filter((event) => !isGroupGathering(event) && new Date(event.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const [editingNews, setEditingNews] = useState<Partial<CmsNewsArticle> | null>(null);
  const [isNewNews, setIsNewNews] = useState(false);

  const handleOpenEditNews = (article: CmsNewsArticle) => {
    setEditingNews({ ...article });
    setIsNewNews(false);
  };

  const handleOpenNewNews = () => {
    setEditingNews({
      title: "",
      slug: "",
      summary: "",
      content: "Skriv artikkelteksten her...\n\nFlere avsnitt kan legges til med linjeskift.",
      category: "aktuelt",
      author: currentUser.name || "Menigheten",
      isPublished: true,
      publishedAt: new Date().toISOString(),
    });
    setIsNewNews(true);
  };

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNews || !editingNews.title) {
      showFeedback("Artikkelen må ha en tittel", "error");
      return;
    }
    if (!(await saveNews(editingNews))) return;
    setEditingNews(null);
    showFeedback("Nyhetsartikkelen ble lagret og publisert!");
  };

  useEffect(() => {
    if (createRequested) {
      handleOpenNewNews();
      onCreateHandled();
    }
  }, [createRequested]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Aktuelt & Nyhetsartikler</h2>
          <p className="text-xs text-[var(--studio-muted)]">
            Publiser nyheter, rapporter fra leir og oppdateringer for menighetens forside.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenNewNews}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Ny artikkel</span>
        </button>
      </div>

      {/* News Editor Modal / Panel */}
      {editingNews && (
        <form onSubmit={handleSaveNews} className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-indigo-500/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[var(--studio-icon)]" />
              <span>{isNewNews ? "Skriv ny artikkel" : `Rediger artikkel: ${editingNews.title}`}</span>
            </h3>
            <button
              type="button"
              onClick={() => setEditingNews(null)}
              className="text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Tittel</label>
              <input
                type="text"
                value={editingNews.title || ""}
                onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                placeholder="f.eks. Flott oppstart for høstens søndagsskole"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden focus:border-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-[var(--studio-muted)]">Kategori</label>
                <select
                  value={editingNews.category || "aktuelt"}
                  onChange={(e) => setEditingNews({ ...editingNews, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden"
                >
                  <option value="aktuelt">Aktuelt</option>
                  <option value="gudstjeneste">Gudstjeneste</option>
                  <option value="ungdom">Ungdom</option>
                  <option value="misjon">Misjon</option>
                  <option value="familie">Familie</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[var(--studio-muted)]">Forfatter</label>
                <input
                  type="text"
                  value={editingNews.author || ""}
                  onChange={(e) => setEditingNews({ ...editingNews, author: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-[var(--studio-muted)]">Ingress / Sammendrag</label>
            <textarea
              rows={2}
              value={editingNews.summary || ""}
              onChange={(e) => setEditingNews({ ...editingNews, summary: e.target.value })}
              placeholder="En kort innledning som fanger oppmerksomheten..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-[var(--studio-muted)]">Artikkeltekst</label>
            <textarea
              rows={7}
              value={editingNews.content || ""}
              onChange={(e) => setEditingNews({ ...editingNews, content: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-mono text-xs focus:outline-hidden leading-relaxed"
            />
          </div>

          {/* How long the article is shown on the website */}
          <div className="p-4 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="news-event" className="font-semibold text-[var(--studio-muted)]">
                  Hører til arrangement (valgfritt)
                </label>
                <select
                  id="news-event"
                  value={editingNews.gatheringRefId || ""}
                  onChange={(e) => setEditingNews({ ...editingNews, gatheringRefId: e.target.value || undefined })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden"
                >
                  <option value="">Ikke noe arrangement</option>
                  {/* The event the article already belongs to stays in the list when it is over */}
                  {allEvents
                    .filter((event) => event.id === editingNews.gatheringRefId && !comingEvents.includes(event))
                    .concat(comingEvents)
                    .map((event) => (
                      <option key={event.id} value={event.id}>
                        {formatNorwegianDateTime(event.startsAt)} · {event.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="news-last-day" className="font-semibold text-[var(--studio-muted)]">
                  Vises til og med (valgfritt)
                </label>
                <input
                  id="news-last-day"
                  type="date"
                  value={editingNews.expiresAt || ""}
                  onChange={(e) => setEditingNews({ ...editingNews, expiresAt: e.target.value || undefined })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden"
                />
              </div>
            </div>
            <p className="text-[var(--studio-muted)]">
              <strong className="text-[var(--studio-text)]">{shownUntil(lastDayOf(editingNews, allEvents))}</strong> En artikkel som hører til et
              arrangement, går ut av forsiden av seg selv dagen etter arrangementet, og følger med hvis arrangementet flyttes. En dato i feltet
              «Vises til og med» går foran.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-[var(--studio-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={editingNews.isPublished !== false}
                onChange={(e) => setEditingNews({ ...editingNews, isPublished: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-0"
              />
              <span>Publiser artikkelen direkte på nettsiden</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingNews(null)}
                className="px-4 py-2 rounded-xl bg-[var(--studio-row)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] text-xs font-semibold border border-[var(--studio-border)]"
              >
                Avbryt
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm"
              >
                Lagre artikkel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* List of News */}
      <div className="space-y-3">
        {news.map((item) => {
          const last = lastDayOf(item, allEvents);
          const expired = isNewsExpired(item, allEvents, now);
          return (
          <div
            key={item.id}
            className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[var(--studio-border)] transition-all"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-icon)] bg-[var(--studio-accent-bg)] px-2 py-0.5 rounded">
                  {item.category}
                </span>
                <h3 className="font-bold text-[var(--studio-text)] text-base">{item.title}</h3>
              </div>
              <p className="text-xs text-[var(--studio-muted)] line-clamp-1">{item.summary}</p>
              <div className="text-[11px] text-[var(--studio-muted)]">
                Av {item.author} · {new Date(item.publishedAt).toLocaleDateString("no-NO")}
              </div>
              {/* Said with an icon and in words, never by colour alone */}
              {expired ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                  <Clock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  Utløpt {writtenDay(last!.day)}. Vises ikke lenger på forsiden
                </span>
              ) : (
                last && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--studio-muted)]">
                    <CalendarClock className="w-3.5 h-3.5 text-[var(--studio-icon)]" aria-hidden="true" />
                    {shownUntil(last)}
                  </span>
                )
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Link
                to={`/artikkel/${item.id}`}
                target="_blank"
                className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                title="Les artikkel"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => handleOpenEditNews(item)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rediger</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Vil du slette artikkelen "${item.title}"?`)) {
                    if (await deleteNews(item.id)) showFeedback("Artikkelen ble slettet");
                  }
                }}
                className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400"
                title="Slett artikkel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
