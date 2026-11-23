import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatNorwegianDateTime,
} from "../../../hooks/useAppHooks";
import { Gathering, GatheringVisibility } from "../../../types";
import { visibilityOf, visibilityFields } from "../../../utils/visibility";
import { locationOf } from "../../../utils/gatherings";
import {
  Image as ImageIcon,
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
import { EventsFilter, countByFilter, filterEvents, groupByMonth } from "../../../utils/eventsOnWebsite";

interface VisibilityTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

const FILTERS: { value: EventsFilter; label: string }[] = [
  { value: "kommende", label: "Kommende" },
  { value: "mangler", label: "Mangler bilde og tekst" },
  { value: "offentlig", label: "Offentlig" },
  { value: "intern", label: "Kun intern" },
  { value: "fremhevet", label: "Fremhevet" },
  { value: "tidligere", label: "Tidligere" },
];

const VISIBILITY_LABEL: Record<GatheringVisibility, string> = {
  fremhevet: "Fremhevet",
  offentlig: "Offentlig",
  intern: "Kun intern",
};

// The pill colour of each visibility, both as the shown value and in the menu
const VISIBILITY_PILL: Record<GatheringVisibility, string> = {
  fremhevet: "bg-amber-400 text-slate-950",
  offentlig: "bg-blue-600 text-white",
  intern: "bg-rose-600 text-white",
};

const MISSING_WORDS = { bilde: "bilde", tekst: "tekst" } as const;

// Below this width the table scrolls inside its own box, the page itself does not
const TABLE_MIN_WIDTH = "min-w-[40rem]";

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
  const [filter, setFilter] = useState<EventsFilter>("kommende");
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

  const allGatherings = adminGatherings.map((item) => item.gathering);
  const now = new Date();
  const counts = countByFilter(allGatherings, now);
  const shown = filterEvents(allGatherings, filter, now);
  const months = groupByMonth(shown);

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

      <div role="group" aria-label="Vis arrangementer" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
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

      {months.length === 0 ? (
        <p className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-sm text-[var(--studio-muted)]">
          Ingen arrangementer her.
        </p>
      ) : (
        months.map((month) => (
          <section key={month.key} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--studio-muted)]">{month.label}</h3>
            <div className="overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]">
              <table className={`w-full ${TABLE_MIN_WIDTH} text-xs table-fixed`}>
                {/* The same widths in every month, so the columns line up down the page */}
                <colgroup>
                  <col style={{ width: "5.5rem" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "13%" }} />
                  <col />
                </colgroup>
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[var(--studio-muted)] border-b border-[var(--studio-border)]">
                    <th scope="col" className="px-3 py-2 font-bold">
                      <span className="sr-only">Bilde</span>
                    </th>
                    <th scope="col" className="px-3 py-2 font-bold">Arrangement</th>
                    <th scope="col" className="px-3 py-2 font-bold">Dato</th>
                    <th scope="col" className="px-3 py-2 font-bold">På nettsiden</th>
                    <th scope="col" className="px-3 py-2 font-bold">Bilde og tekst</th>
                    <th scope="col" className="px-3 py-2 font-bold">
                      <span className="sr-only">Handlinger</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {month.items.map((g) => {
                    const visibility = visibilityOf(g);
                    const thumbnail = resolveMediaUrl(g.imageUrl, mediaById, "thumb");
                    const missing = missingOnWebsite(g);
                    const notAsked = visibility === "intern" || g.type === "gruppesamling";
                    const needsWork = visibility !== "intern" && missing.length > 0;

                    return (
                      <tr key={g.id} className="border-b border-[var(--studio-border)] last:border-b-0 align-middle">
                        <td className="px-3 py-2">
                          {thumbnail ? (
                            <img src={thumbnail} alt="" loading="lazy" className="w-16 h-10 object-cover rounded-md bg-[var(--studio-bg)]" />
                          ) : (
                            <div aria-hidden="true" className="w-16 h-10 rounded-md border border-dashed border-[var(--studio-border)]" />
                          )}
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          <span className="block font-bold text-[var(--studio-text)] text-sm truncate" title={g.title}>{g.title}</span>
                          {g.theme && <span className="block text-[var(--studio-muted)] truncate">Tema: {g.theme}</span>}
                          <span className="block text-[var(--studio-muted)] truncate">{locationOf(g)}</span>
                        </td>
                        <td className="px-3 py-2 text-[var(--studio-muted)]">{formatNorwegianDateTime(g.startsAt)}</td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`Synlighet på nettsiden for ${g.title}`}
                            value={visibility}
                            onChange={(event) => handleSetGatheringVisibility(g.id, event.target.value as GatheringVisibility)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer border-0 ${VISIBILITY_PILL[visibility]}`}
                          >
                            {(Object.keys(VISIBILITY_LABEL) as GatheringVisibility[]).map((option) => (
                              <option key={option} value={option} className="bg-slate-900 text-white">
                                {VISIBILITY_LABEL[option]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {notAsked ? (
                            <span className="text-[var(--studio-muted)]" aria-label="Ikke aktuell">–</span>
                          ) : missing.length > 0 ? (
                            <span
                              title={`Mangler ${missing.map((what) => MISSING_WORDS[what]).join(" og ")}`}
                              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 border border-amber-800 text-amber-300"
                            >
                              Mangler
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                              Har
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
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
                              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                needsWork
                                  ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                                  : "bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] border border-[var(--studio-border)]"
                              }`}
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

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
