import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../../context/CmsContext";
import { draftFingerprint, useLeaveGuard, useReportUnsaved, useSaveShortcut } from "../../../hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "./pages/UnsavedChangesDialog";
import { NewsEndDateDialog } from "./NewsEndDateDialog";
import { NewsPreviewDialog } from "./NewsPreviewDialog";
import { CmsMediaPicker } from "../../../components/admin/CmsMediaPicker";

// The text field with buttons, loaded the first time an article is opened
const RichTextField = lazy(() => import("../../../components/admin/RichTextField"));
import { CmsNewsArticle } from "../../../data/cmsData";
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  X,
  Newspaper,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { AlertTriangle, Eye, History } from "lucide-react";
import { VersionHistoryDialog } from "../../../components/admin/VersionHistoryDialog";
import { restoredFields } from "../../../utils/contentVersions";
import { formatNorwegianDateTime } from "../../../utils/dates";
import { isGroupGathering } from "../../../utils/gatherings";
import { daysStandingLong, isNewsExpired, lastDayOf, needsLastDay, suggestedLastDay, type LastDay } from "../../../utils/news";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";
import { lastEditedText } from "../../../utils/lastEdited";
import { countNewsByFilter, filterNews, newsStatusOf, type NewsFilter } from "../../../utils/newsStatus";
import { useConfirm } from "../../../components/ConfirmProvider";

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

const NEWS_FILTERS: { value: NewsFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "publisert", label: "Publisert" },
  { value: "kladd", label: "Kladd" },
  { value: "planlagt", label: "Planlagt" },
  { value: "gar-ut", label: "Går snart ut" },
];

// The pill colour of each status. Each one also says what it is in words, so colour is not the only sign.
const NEWS_STATUS_PILL: Record<"kladd" | "planlagt" | "gar-ut" | "gatt-ut" | "publisert", string> = {
  publisert: "bg-emerald-950/80 text-emerald-300 border border-emerald-800",
  kladd: "bg-slate-800 text-slate-200 border border-slate-600",
  planlagt: "bg-blue-950/90 text-blue-300 border border-blue-800",
  "gar-ut": "bg-amber-950/80 text-amber-300 border border-amber-800",
  "gatt-ut": "bg-red-950/80 text-red-300 border border-red-900",
};

// Below this width the table scrolls inside its own box, the page itself does not
const TABLE_MIN_WIDTH = "min-w-[48rem]";

interface NewsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
  /** Set when another tab asks for this one to open with a new, empty editor. */
  createRequested: boolean;
  onCreateHandled: () => void;
}

export const NewsTab: React.FC<NewsTabProps> = ({ studio, showFeedback, createRequested, onCreateHandled }) => {
  const confirmInPage = useConfirm();
  const { currentUser, adminGatherings } = studio;
  const { news, saveNews, deleteNews, settings } = useCms();
  const { allPersons } = useFirebase();
  const mediaById = useMediaMap();
  const [previewing, setPreviewing] = useState(false);
  const [filter, setFilter] = useState<NewsFilter>("alle");

  // The events an article can belong to: those open to the congregation that lie ahead, the nearest first
  const now = Date.now();
  const allEvents = adminGatherings.map((item) => item.gathering);
  const comingEvents = allEvents
    .filter((event) => !isGroupGathering(event) && new Date(event.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // The list: the articles the filter shows, and how many each filter has
  const counts = countNewsByFilter(news, allEvents, now);
  const shownNews = filterNews(news, filter, allEvents, now);
  const nameOf = (personId: string) => allPersons.find((person) => person.id === personId)?.name;

  const [editingNews, setEditingNews] = useState<Partial<CmsNewsArticle> | null>(null);
  const [isNewNews, setIsNewNews] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // The article as it was opened, to tell whether the editor holds changes that are not saved
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const unsaved = editingNews !== null && draftFingerprint(editingNews) !== savedFingerprint;

  // Asked before an article is saved with nothing that ends it (see NewsEndDateDialog)
  const [askLastDay, setAskLastDay] = useState(false);
  const saveDraft = async (draft = editingNews, askAboutLastDay = true): Promise<boolean> => {
    if (!draft || !draft.title) {
      showFeedback("Artikkelen må ha en tittel", "error");
      return false;
    }
    if (askAboutLastDay && needsLastDay(draft, allEvents)) {
      setAskLastDay(true);
      return false;
    }
    if (!(await saveNews(draft))) return false;
    setEditingNews(null);
    showFeedback("Nyhetsartikkelen ble lagret og publisert!");
    return true;
  };
  const saveCurrent = () => saveDraft();
  const { leave, dialog } = useLeaveGuard(unsaved, saveCurrent);
  useReportUnsaved("cms-nyheter", unsaved, editingNews?.title, saveCurrent);
  const formRef = useRef<HTMLFormElement>(null);
  useSaveShortcut(formRef, editingNews !== null, saveCurrent);
  const lastDaySuggestion = editingNews ? suggestedLastDay(editingNews, now) : null;

  const openDraft = (article: Partial<CmsNewsArticle>, isNew: boolean) => {
    setEditingNews(article);
    setIsNewNews(isNew);
    setSavedFingerprint(draftFingerprint(article));
  };

  const handleOpenEditNews = (article: CmsNewsArticle) => {
    if (editingNews?.id === article.id) return;
    leave(() => openDraft({ ...article }, false));
  };

  const handleOpenNewNews = () => leave(() => openDraft({
      title: "",
      slug: "",
      summary: "",
      imageUrl: "",
      imageAlt: "",
      content: "Skriv artikkelteksten her...\n\nFlere avsnitt kan legges til med linjeskift.",
      category: "aktuelt",
      author: currentUser.name || "Menigheten",
      isPublished: true,
      publishedAt: new Date().toISOString(),
    }, true));
  const handleCloseNews = () => leave(() => setEditingNews(null));

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveDraft();
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
        <form ref={formRef} onSubmit={handleSaveNews} className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-indigo-500/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[var(--studio-icon)]" />
              <span>{isNewNews ? "Skriv ny artikkel" : `Rediger artikkel: ${editingNews.title}`}</span>
            </h3>
            <div className="flex items-center gap-2">
            {!isNewNews && editingNews.id && (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="px-3 py-1.5 rounded-xl border border-[var(--studio-border)] text-[var(--studio-accent-text)] hover:bg-[var(--studio-hover)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
                <span>Historikk</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseNews}
              className="text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            >
              <X className="w-5 h-5" />
            </button>
            </div>
          </div>

          {showHistory && editingNews.id && (
            <VersionHistoryDialog
              kind="news"
              targetId={editingNews.id}
              current={editingNews as Record<string, unknown>}
              onRestore={(version) => {
                setEditingNews({ ...editingNews, ...(restoredFields(version) as Partial<CmsNewsArticle>) });
                setShowHistory(false);
              }}
              onClose={() => setShowHistory(false)}
            />
          )}

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
            <CmsMediaPicker
              label="Bilde"
              value={editingNews.imageUrl || ""}
              onChange={(url) => setEditingNews((current) => (current ? { ...current, imageUrl: url } : current))}
              altValue={editingNews.imageAlt || ""}
              onAltChange={(alt) => setEditingNews((current) => (current ? { ...current, imageAlt: alt } : current))}
              helpText="Vises på nyhetskortet og øverst i artikkelen."
              decorative
            />
          </div>

          <div className="space-y-1 text-xs">
            <span className="font-semibold text-[var(--studio-muted)] block">Artikkeltekst</span>
            <Suspense
              fallback={
                <textarea
                  rows={7}
                  aria-label="Artikkeltekst"
                  value={editingNews.content || ""}
                  onChange={(e) => setEditingNews({ ...editingNews, content: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden leading-relaxed"
                />
              }
            >
              <RichTextField
                key={editingNews.id ?? "ny"}
                mode="full"
                label="Artikkeltekst"
                rows={7}
                value={editingNews.content || ""}
                onChange={(content) => setEditingNews((current) => (current ? { ...current, content } : current))}
              />
            </Suspense>
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
                onClick={handleCloseNews}
                className="px-4 py-2 rounded-xl bg-[var(--studio-row)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] text-xs font-semibold border border-[var(--studio-border)]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => setPreviewing(true)}
                className="px-4 py-2 rounded-xl bg-[var(--studio-row)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] text-xs font-semibold border border-[var(--studio-border)] flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Forhåndsvis
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

      {/* List of News: a filter row, then one table */}
      <div role="group" aria-label="Vis nyheter" className="flex flex-wrap gap-2">
        {NEWS_FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-[var(--studio-bg)] text-[var(--studio-text)] border border-[var(--studio-border)] hover:bg-[var(--studio-hover)]"
              }`}
            >
              <span>{option.label}</span>
              <span className={active ? "text-white/85" : "text-[var(--studio-muted)]"}>{counts[option.value]}</span>
            </button>
          );
        })}
      </div>

      {shownNews.length === 0 ? (
        <p className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-sm text-[var(--studio-muted)]">
          Ingen nyheter her.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]">
          <table className={`w-full ${TABLE_MIN_WIDTH} text-xs table-fixed`}>
            <colgroup>
              <col style={{ width: "6.5rem" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10rem" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--studio-border)] text-left text-[var(--studio-muted)]">
                <th scope="col" className="px-3 py-2 font-bold">
                  <span className="sr-only">Bilde</span>
                </th>
                <th scope="col" className="px-3 py-2 font-bold">Artikkel</th>
                <th scope="col" className="px-3 py-2 font-bold">Kategori</th>
                <th scope="col" className="px-3 py-2 font-bold">Status</th>
                <th scope="col" className="px-3 py-2 font-bold">Sist endret</th>
                <th scope="col" className="px-3 py-2 font-bold">
                  <span className="sr-only">Handlinger</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shownNews.map((item) => {
                const last = lastDayOf(item, allEvents);
                const expired = isNewsExpired(item, allEvents, now);
                const standing = daysStandingLong(item, allEvents, now);
                const status = newsStatusOf(item, allEvents, now);
                const thumbnail = resolveMediaUrl(item.imageUrl, mediaById, "thumb");
                const edited = lastEditedText(item, nameOf, now);
                return (
                  <tr key={item.id} className="border-b border-[var(--studio-border)] last:border-b-0 align-middle">
                    <td className="px-3 py-2">
                      {thumbnail ? (
                        <img src={thumbnail} alt="" loading="lazy" className="w-16 h-10 object-cover rounded-md bg-[var(--studio-bg)]" />
                      ) : (
                        <div aria-hidden="true" className="w-16 h-10 rounded-md border border-dashed border-[var(--studio-border)]" />
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-0">
                      <span className="block font-bold text-[var(--studio-text)] text-sm break-words">{item.title}</span>
                      <span className="block text-[var(--studio-muted)]">Av {item.author}</span>
                      {/* How long the article is shown, or that it is over */}
                      {expired ? (
                        <span className="block text-[var(--studio-muted)]">Utløpt {writtenDay(last!.day)}. Vises ikke lenger på forsiden</span>
                      ) : (
                        last && <span className="block text-[var(--studio-muted)]">{shownUntil(last)}</span>
                      )}
                      {/* An article without a last day that has stood long may be about something that is over */}
                      {standing !== null && (
                        <span data-news-standing className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                          Ingen siste dag, og har stått i {standing} dager. Er den fortsatt aktuell?
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--studio-muted)] break-words">{item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : ""}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${NEWS_STATUS_PILL[status.kind]}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--studio-muted)]">{edited ?? `Publisert ${new Date(item.publishedAt).toLocaleDateString("no-NO")}`}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2 text-xs">
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
                            if (await confirmInPage(`Flytte «${item.title}» til papirkurven? Du kan hente den tilbake i 30 dager.`, { yes: "Flytt til papirkurven", danger: true })) {
                              if (await deleteNews(item.id)) showFeedback("Artikkelen er flyttet til papirkurven");
                            }
                          }}
                          className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400"
                          title="Slett artikkel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <UnsavedChangesDialog {...dialog} pageTitle={editingNews?.title} what="artikkelen" />
      {previewing && editingNews && <NewsPreviewDialog article={editingNews} churchName={settings.churchName} onClose={() => setPreviewing(false)} />}
      <NewsEndDateDialog
        open={askLastDay}
        suggestion={lastDaySuggestion}
        onUseSuggestion={() => {
          setAskLastDay(false);
          if (editingNews && lastDaySuggestion) void saveDraft({ ...editingNews, expiresAt: lastDaySuggestion }, false);
        }}
        onChooseDate={() => {
          setAskLastDay(false);
          window.requestAnimationFrame(() => {
            const field = document.getElementById("news-last-day") as HTMLInputElement | null;
            field?.scrollIntoView({ block: "center" });
            field?.focus();
          });
        }}
        onSaveWithout={() => {
          setAskLastDay(false);
          void saveDraft(editingNews, false);
        }}
      />
    </div>
  );
};
