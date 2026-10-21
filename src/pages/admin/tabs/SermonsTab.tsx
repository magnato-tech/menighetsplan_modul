import React, { useRef, useState } from "react";
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

interface SermonsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

export const SermonsTab: React.FC<SermonsTabProps> = ({ studio, showFeedback }) => {
  const { currentUser } = studio;
  const { sermons, saveSermon, deleteSermon } = useCms();
  const mediaById = useMediaMap();

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

      {/* List of Sermons */}
      <div className="space-y-3">
        {sermons.map((s) => (
          <div
            key={s.id}
            className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            {resolveMediaUrl(s.imageUrl, mediaById, "thumb") && (
              <img
                src={resolveMediaUrl(s.imageUrl, mediaById, "thumb")}
                alt=""
                loading="lazy"
                className="w-24 aspect-video object-cover rounded-lg shrink-0 bg-[var(--studio-bg)]"
              />
            )}
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-[var(--studio-text)] text-base">{s.title}</h3>
                {s.series && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded">
                    {s.series}
                  </span>
                )}
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
              <div className="text-xs text-[var(--studio-muted)] flex flex-wrap gap-3">
                <span>Taler: <strong className="text-slate-200">{s.speaker || s.guestSpeakerName || "Ikke oppgitt"}</strong></span>
                {s.bibleText && <span>Bibel: {s.bibleText}</span>}
                <span>Dato: {new Date(s.date).toLocaleDateString("no-NO")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
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
                  if (confirm(`Vil du slette talen "${s.title}"?`)) {
                    if (await deleteSermon(s.id)) showFeedback("Talen ble slettet");
                  }
                }}
                className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400"
                title="Slett tale"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <UnsavedChangesDialog {...dialog} pageTitle={editingSermon?.title} what="talen" />
    </div>
  );
};
