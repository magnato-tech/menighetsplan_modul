import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../../context/CmsContext";
import { draftFingerprint, useLeaveGuard, useReportUnsaved, useSaveShortcut } from "../../../hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "./pages/UnsavedChangesDialog";
import { CmsSermon, formatYoutubeNoCookieUrl } from "../../../data/cmsData";
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  X,
  Headphones,
  Play,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { CmsMediaPicker } from "../../../components/admin/CmsMediaPicker";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";
import { filterSermons, sermonFilterOptions, sermonSpeakerOf } from "../../../utils/sermonFilter";

interface SermonsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

/** A dropdown for one filter. The first choice, «Alle», means no filter. */
const FilterSelect: React.FC<FilterSelectProps> = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1 min-w-0 flex-1 sm:flex-none sm:w-44 text-xs">
    <span className="font-semibold text-[var(--studio-muted)]">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
    >
      <option value="">Alle</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

export const SermonsTab: React.FC<SermonsTabProps> = ({ studio, showFeedback }) => {
  const { currentUser } = studio;
  const { sermons, saveSermon, deleteSermon } = useCms();
  const mediaById = useMediaMap();

  // Search and filters above the list
  const [query, setQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const filterOptions = useMemo(() => sermonFilterOptions(sermons), [sermons]);
  const visibleSermons = useMemo(
    () => filterSermons(sermons, { query, series: seriesFilter, speaker: speakerFilter, year: yearFilter }),
    [sermons, query, seriesFilter, speakerFilter, yearFilter],
  );
  const filtersActive = query.trim() !== "" || seriesFilter !== "" || speakerFilter !== "" || yearFilter !== "";
  const countText = visibleSermons.length === 1 ? "1 tale" : visibleSermons.length + " taler";
  const resetFilters = () => {
    setQuery("");
    setSeriesFilter("");
    setSpeakerFilter("");
    setYearFilter("");
  };

  const [editingSermon, setEditingSermon] = useState<Partial<CmsSermon> | null>(null);
  const [isNewSermon, setIsNewSermon] = useState(false);
  // The talk as it was opened, to tell whether the editor holds changes that are not saved
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const unsaved = editingSermon !== null && draftFingerprint(editingSermon) !== savedFingerprint;

  const saveDraft = async (): Promise<boolean> => {
    if (!editingSermon || !editingSermon.title) {
      showFeedback("Talen må ha en tittel", "error");
      return false;
    }
    const cleanVideoUrl = formatYoutubeNoCookieUrl(editingSermon.videoUrl || "");
    const saved = await saveSermon({
      ...editingSermon,
      videoUrl: cleanVideoUrl,
    });
    if (!saved) return false;
    setEditingSermon(null);
    showFeedback("Talen ble lagret og publisert til prekenarkivet!");
    return true;
  };
  const { leave, dialog } = useLeaveGuard(unsaved, saveDraft);
  useReportUnsaved("cms-taler", unsaved, editingSermon?.title, saveDraft);
  const formRef = useRef<HTMLFormElement>(null);
  useSaveShortcut(formRef, editingSermon !== null, saveDraft);

  const openDraft = (sermon: Partial<CmsSermon>, isNew: boolean) => {
    setEditingSermon(sermon);
    setIsNewSermon(isNew);
    setSavedFingerprint(draftFingerprint(sermon));
  };

  const handleOpenEditSermon = (sermon: CmsSermon) => {
    if (editingSermon?.id === sermon.id) return;
    leave(() => openDraft({ ...sermon }, false));
  };

  const handleOpenNewSermon = () => leave(() => openDraft({
      title: "",
      speaker: currentUser.name || "Pastor Kari Nordmann",
      date: new Date().toISOString(),
      bibleText: "",
      series: "",
      audioUrl: "",
      videoUrl: "",
      imageUrl: "",
      summary: "",
    }, true));
  const handleCloseSermon = () => leave(() => setEditingSermon(null));

  const handleSaveSermon = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveDraft();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Taler & Prekenarkiv</h2>
          <p className="text-xs text-[var(--studio-muted)]">
            Last opp eller lenk opptak fra søndagens gudstjenester med taler, bibeltekst og serie.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenNewSermon}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Legg til tale</span>
        </button>
      </div>

      {/* Sermon Editor Form */}
      {editingSermon && (
        <form ref={formRef} onSubmit={handleSaveSermon} className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-amber-500/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
              <Headphones className="w-4 h-4 text-amber-400" />
              <span>{isNewSermon ? "Legg til ny tale" : `Rediger tale: ${editingSermon.title}`}</span>
            </h3>
            <button type="button" onClick={handleCloseSermon} className="text-[var(--studio-muted)] hover:text-[var(--studio-text)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Tittel på talen</label>
              <input
                type="text"
                value={editingSermon.title || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, title: e.target.value })}
                placeholder="f.eks. Guds rike er kommet nær"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Taler</label>
              <input
                type="text"
                value={editingSermon.speaker || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, speaker: e.target.value })}
                placeholder="f.eks. Pastor Kari Nordmann"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Bibeltekst</label>
              <input
                type="text"
                value={editingSermon.bibleText || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, bibleText: e.target.value })}
                placeholder="f.eks. Markus 1,14–15"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Taleserie (valgfritt)</label>
              <input
                type="text"
                value={editingSermon.series || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, series: e.target.value })}
                placeholder="f.eks. Vandring gjennom Markus"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Spotify-lenke (Episode eller Podkast)</label>
              <input
                type="url"
                value={editingSermon.spotifyUrl || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/episode/..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-emerald-400 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Lydfil (MP3)</label>
              <input
                type="url"
                value={editingSermon.audioUrl || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, audioUrl: e.target.value })}
                placeholder="https://.../tale.mp3"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-mono text-xs"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="font-semibold text-[var(--studio-muted)]">Videoadresse (YouTube/Vimeo)</label>
              <input
                type="url"
                value={editingSermon.videoUrl || ""}
                onChange={(e) => setEditingSermon({ ...editingSermon, videoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-mono text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <CmsMediaPicker
                label="Bilde til talen (valgfritt)"
                value={editingSermon.imageUrl || ""}
                onChange={(url) => setEditingSermon({ ...editingSermon, imageUrl: url })}
                helpText="Vises ved siden av talen i talearkivet, og på forsiden når talen er den nyeste."
                decorative
              />
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-[var(--studio-muted)]">Kort sammendrag av talen</label>
            <textarea
              rows={3}
              value={editingSermon.summary || ""}
              onChange={(e) => setEditingSermon({ ...editingSermon, summary: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseSermon}
              className="px-4 py-2 rounded-xl bg-[var(--studio-hover)] hover:bg-[var(--studio-border)] text-[var(--studio-text)] text-xs font-semibold"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm"
            >
              Lagre tale
            </button>
          </div>
        </form>
      )}

      {/* Search and filters */}
      <div className="space-y-3">
        <input
          type="search"
          aria-label="Søk i talene"
          placeholder="Søk i tittel, taler eller bibeltekst …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
        />
        <div className="flex flex-wrap gap-3">
          <FilterSelect label="Serie" value={seriesFilter} onChange={setSeriesFilter} options={filterOptions.series} />
          <FilterSelect label="Taler" value={speakerFilter} onChange={setSpeakerFilter} options={filterOptions.speakers} />
          <FilterSelect label="År" value={yearFilter} onChange={setYearFilter} options={filterOptions.years} />
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--studio-muted)]">
          <span>{countText}</span>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-amber-400 hover:text-amber-300 hover:underline underline-offset-2"
            >
              Nullstill
            </button>
          )}
        </div>
      </div>

      {/* List of Sermons */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]">
        <table className="w-full min-w-[52rem] text-xs table-fixed">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[var(--studio-muted)] border-b border-[var(--studio-border)]">
              <th className="px-3 py-2 w-[30%]">Tale</th>
              <th className="px-3 py-2 w-[14%]">Serie</th>
              <th className="px-3 py-2 w-[14%]">Taler</th>
              <th className="px-3 py-2 w-[12%]">Bibel</th>
              <th className="px-3 py-2 w-[10%]">Dato</th>
              <th className="px-3 py-2 w-[20%] text-right">
                <span className="sr-only">Handlinger</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleSermons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--studio-muted)]">
                  {sermons.length === 0 ? "Ingen taler ennå." : "Ingen taler passer til søket."}
                </td>
              </tr>
            )}
            {visibleSermons.map((s) => {
              const speaker = sermonSpeakerOf(s);
              const thumb = resolveMediaUrl(s.imageUrl, mediaById, "thumb");
              return (
                <tr key={s.id} className="border-b border-[var(--studio-border)] last:border-b-0 align-middle">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {thumb && (
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          className="w-16 h-10 object-cover rounded-md shrink-0 bg-[var(--studio-bg)]"
                        />
                      )}
                      <div className="space-y-1 min-w-0">
                        <span className="block font-bold text-[var(--studio-text)] text-sm truncate" title={s.title}>
                          {s.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {s.videoUrl && (
                            <span className="text-[10px] font-bold text-[var(--studio-accent-text)] bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] px-2 py-0.5 rounded flex items-center gap-1">
                              <Play className="w-3 h-3 text-[var(--studio-icon)]" />
                              Video (nocookie)
                            </span>
                          )}
                          {s.audioUrl && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                              <Headphones className="w-3 h-3 text-amber-400" />
                              Lyd
                            </span>
                          )}
                          {!s.videoUrl && !s.audioUrl && (
                            <span className="text-[10px] text-[var(--studio-muted)] bg-[var(--studio-bg)] px-2 py-0.5 rounded">
                              Kun notat
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--studio-muted)] truncate" title={s.series || undefined}>
                    {s.series || "–"}
                  </td>
                  <td className="px-3 py-2 text-[var(--studio-text)] truncate" title={speaker || undefined}>
                    {speaker || "Ikke oppgitt"}
                  </td>
                  <td className="px-3 py-2 text-[var(--studio-muted)] truncate" title={s.bibleText || undefined}>
                    {s.bibleText || "–"}
                  </td>
                  <td className="px-3 py-2 text-[var(--studio-muted)] whitespace-nowrap">
                    {new Date(s.date).toLocaleDateString("no-NO")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <Link
                        to="/taler"
                        target="_blank"
                        className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                        title="Hør i arkiv"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleOpenEditSermon(s)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-slate-950 font-bold flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Rediger</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Flytte «${s.title}» til papirkurven? Du kan hente den tilbake i 30 dager.`)) {
                            if (await deleteSermon(s.id)) showFeedback("Talen er flyttet til papirkurven");
                          }
                        }}
                        className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400"
                        title="Slett tale"
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

      <UnsavedChangesDialog {...dialog} pageTitle={editingSermon?.title} what="talen" />
    </div>
  );
};
