import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatNorwegianDateTime,
} from "../../../hooks/useAppHooks";
import { Gathering, GatheringVisibility } from "../../../types";
import { visibilityOf, visibilityFields } from "../../../utils/visibility";
import { locationOf } from "../../../utils/gatherings";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Star,
  EyeOff,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { GatheringFormDialog } from "../../../components/gathering/GatheringFormDialog";
import { GatheringWebsiteDialog } from "../../../components/gathering/GatheringWebsiteDialog";
import { isWebEditor } from "../../../utils/session";
import { useLevel } from "../../../hooks/useLevel";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { formOfGathering, gatheringUpdatesOf } from "../../../utils/gatheringForm";
import { missingOnWebsite, templateImageFor } from "../../../utils/gatheringPresentation";
import { useGatheringTemplates } from "../../../hooks/useGatheringTemplates";
import { hasPlanner } from "../../../utils/level";
import { resolveMediaUrl } from "../../../utils/media";

interface VisibilityTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

const MISSING_WORDS = { bilde: "bilde", tekst: "tekst" } as const;

/**
 * «Arrangementer på nettsiden»: every event with who sees it, its picture, and what it is still
 * without on the website. The picture and the text are filled in in the event's own form, opened
 * here on the part about the website (see utils/gatheringForm.ts).
 */
export const VisibilityTab: React.FC<VisibilityTabProps> = ({ studio, showFeedback }) => {
  const { adminGatherings, adminGroups, updateGathering, currentUser } = studio;
  // A web editor gives the events picture and text only; the planning is not theirs
  const webEditor = isWebEditor(currentUser);
  const mediaById = useMediaMap();
  const withPlanner = hasPlanner(useLevel());
  const [editing, setEditing] = useState<Gathering | null>(null);
  // Events without a picture whose template has one: they can take the template's, one by one or all at once
  const { templates } = useGatheringTemplates();
  const fromTemplate = adminGatherings
    .map((item) => ({ gathering: item.gathering, image: templateImageFor(item.gathering, templates) }))
    .filter((entry) => entry.image !== null);
  const applyTemplateImage = (gathering: Gathering) => {
    const image = templateImageFor(gathering, templates);
    if (!image) return false;
    return updateGathering(gathering.id, { imageUrl: image.imageUrl, ...(image.imageAlt ? { imageAlt: image.imageAlt } : {}) }).success;
  };
  const applyTemplateImageToAll = () => {
    const done = fromTemplate.filter((entry) => applyTemplateImage(entry.gathering)).length;
    showFeedback(`${done} ${done === 1 ? "arrangement" : "arrangementer"} fikk bildet fra malen sin`);
  };

  const handleSetGatheringVisibility = (gatheringId: string, visibility: GatheringVisibility) => {
    updateGathering(gatheringId, visibilityFields(visibility));
    showFeedback(`Synlighet oppdatert til: ${visibility === "fremhevet" ? "Fremhevet på forsiden" : visibility === "offentlig" ? "Offentlig kalender" : "Kun intern"}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-[var(--studio-border)] pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Arrangementer på nettsiden</h2>
        <p className="text-xs text-[var(--studio-muted)]">
          Legg bilde og tekst på et arrangement, fremhev det på forsiden, eller hold det utenfor den offentlige kalenderen.
        </p>
      </div>

      {fromTemplate.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)]">
          <p className="text-xs text-[var(--studio-text)]">
            {fromTemplate.length === 1
              ? "Ett arrangement uten bilde er laget fra en mal som har bilde."
              : `${fromTemplate.length} arrangementer uten bilde er laget fra en mal som har bilde.`}
          </p>
          <button
            type="button"
            onClick={applyTemplateImageToAll}
            className="shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Gi dem bildet fra malen</span>
          </button>
        </div>
      )}

      <div className="space-y-3">
        {adminGatherings.map((item) => {
          const g = item.gathering;
          const visibility = visibilityOf(g);
          const isFeatured = visibility === "fremhevet";
          const isHidden = visibility === "intern";
          const isPublic = visibility === "offentlig";
          const thumbnail = resolveMediaUrl(g.imageUrl, mediaById, "thumb");
          const missing = missingOnWebsite(g);

          return (
            <div
              key={g.id}
              className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              {thumbnail && <img src={thumbnail} alt="" loading="lazy" className="w-24 aspect-video object-cover rounded-lg shrink-0 bg-[var(--studio-bg)]" />}
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[var(--studio-text)] text-base">{g.title}</h3>
                  {isFeatured && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-300" />
                      Fremhevet på forsiden
                    </span>
                  )}
                  {isPublic && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                      <Globe className="w-3 h-3 text-emerald-400" />
                      Offentlig i kalender
                    </span>
                  )}
                  {isHidden && (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      Kun intern (skjult på nett)
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--studio-muted)]">
                  {formatNorwegianDateTime(g.startsAt)} · {locationOf(g)}
                  {g.theme && ` · Tema: ${g.theme}`}
                </div>
                {/* What the event is without on the website, said with an icon and in words. An event not shown there is not asked for anything */}
                {!isHidden &&
                  (missing.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                      Mangler {missing.map((what) => MISSING_WORDS[what]).join(" og ")}
                    </span>
                  ) : (
                    g.type !== "gruppesamling" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--studio-muted)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        Har bilde og tekst
                      </span>
                    )
                  ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {templateImageFor(g, templates) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (applyTemplateImage(g)) showFeedback(`«${g.title}» fikk bildet fra malen`);
                    }}
                    className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] border border-[var(--studio-border)] cursor-pointer"
                  >
                    <span>Bruk malens bilde</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(g)}
                  className="px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Bilde og tekst</span>
                </button>

                {/* The event itself is planned in the other part of the admin */}
                {!webEditor && (
                <Link
                  to={`/admin/samling/${g.id}`}
                  className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)]"
                >
                  <span>Åpne i planleggingen</span>
                </Link>
                )}

                <button
                  type="button"
                  onClick={() => handleSetGatheringVisibility(g.id, "fremhevet")}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isFeatured
                      ? "bg-amber-400 text-slate-950 font-bold shadow-xs"
                      : "bg-[var(--studio-bg)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)]"
                  }`}
                  title="Lås til toppen av forsiden"
                >
                  <Star className={`w-3.5 h-3.5 ${isFeatured ? "fill-slate-950" : ""}`} />
                  <span>Fremhev</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetGatheringVisibility(g.id, "offentlig")}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isPublic
                      ? "bg-emerald-600 text-white font-bold shadow-xs"
                      : "bg-[var(--studio-bg)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)]"
                  }`}
                  title="Vises i offentlig kalender"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Offentlig</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetGatheringVisibility(g.id, "intern")}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isHidden
                      ? "bg-rose-600 text-white font-bold shadow-xs"
                      : "bg-[var(--studio-bg)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)]"
                  }`}
                  title="Skjul fra offentlig visning (kun intern planlegger)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Kun intern</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && webEditor && (
        <GatheringWebsiteDialog
          gathering={editing}
          onSave={(updates) => {
            const result = updateGathering(editing.id, updates);
            if (result.success) showFeedback("Arrangementet ble oppdatert!");
            return result;
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {editing && !webEditor && (
        <GatheringFormDialog
          isNew={false}
          initial={formOfGathering(editing)}
          groups={adminGroups.map(({ group }) => group)}
          showGroup={withPlanner}
          openAt="website"
          onSave={(values) => {
            const result = updateGathering(editing.id, gatheringUpdatesOf(values, withPlanner));
            if (result.success) showFeedback("Arrangementet ble oppdatert!");
            return result;
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
