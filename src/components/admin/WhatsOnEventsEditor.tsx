import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";
import { GatheringFormDialog } from "../gathering/GatheringFormDialog";
import { useLevel } from "../../hooks/useLevel";
import { useMediaMap } from "../../hooks/useMediaMap";
import { formatNorwegianDateTime } from "../../utils/dates";
import { formOfGathering, gatheringUpdatesOf } from "../../utils/gatheringForm";
import { missingOnWebsite } from "../../utils/gatheringPresentation";
import { hasPlanner } from "../../utils/level";
import { resolveMediaUrl } from "../../utils/media";
import { whatsOnGatherings, whatsOnOptionsOf } from "../../utils/whatsOn";
import type { ModulePresentationConfig } from "../../utils/modulePresentation";
import type { Gathering } from "../../types";

const MISSING_WORDS = { bilde: "bilde", tekst: "tekst" } as const;

/**
 * Under «Rediger presentasjon» for «Hva skjer»: the events the module shows right now, with what each
 * is without on the website, and «Bilde og tekst» to fill it in without leaving the page. The picture
 * and the text belong to the event, so they are saved there, as in «Arrangementer på nettsiden».
 */
export const WhatsOnEventsEditor: React.FC<{ config: ModulePresentationConfig }> = ({ config }) => {
  const { gatherings, groups, updateGathering } = useFirebase();
  const mediaById = useMediaMap();
  const withPlanner = hasPlanner(useLevel());
  const [editing, setEditing] = useState<Gathering | null>(null);
  const options = whatsOnOptionsOf(config);
  const shown = useMemo(
    () => whatsOnGatherings(gatherings, Date.now(), options),
    [gatherings, options.count, options.selection, options.groupId]
  );

  return (
    <div className="space-y-2" data-whats-on-events>
      <div>
        <span className="text-[11px] font-semibold text-slate-300 block">Arrangementene som vises nå</span>
        <p className="text-[10px] text-slate-500">Bildet og teksten hører til arrangementet, og lagres der.</p>
      </div>
      {shown.length === 0 ? (
        <p className="text-[11px] text-slate-500">Ingen arrangementer passer valgene over.</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((gathering) => {
            const thumbnail = resolveMediaUrl(gathering.imageUrl, mediaById, "thumb");
            const missing = missingOnWebsite(gathering);
            return (
              <li key={gathering.id} className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <div className="w-14 h-9 shrink-0 rounded overflow-hidden bg-slate-800 flex items-center justify-center">
                  {thumbnail ? (
                    <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{gathering.title}</div>
                  <div className="text-[10px] text-slate-400">{formatNorwegianDateTime(gathering.startsAt)}</div>
                  {missing.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                      <AlertCircle className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      Mangler {missing.map((what) => MISSING_WORDS[what]).join(" og ")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                      Har bilde og tekst
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(gathering)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Bilde og tekst</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Over the whole screen, and kept apart from the page editor around it: the editor is a form of its
          own, and Lagre in this one must not save the page as well */}
      {editing &&
        createPortal(
          <div onSubmit={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <GatheringFormDialog
              isNew={false}
              initial={formOfGathering(editing)}
              groups={groups}
              showGroup={withPlanner}
              openAt="website"
              onSave={(values) => updateGathering(editing.id, gatheringUpdatesOf(values, withPlanner))}
              onClose={() => setEditing(null)}
            />
          </div>,
          document.body
        )}
    </div>
  );
};
