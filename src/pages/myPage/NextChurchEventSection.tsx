import React from "react";
import { Link } from "react-router-dom";
import { formatNorwegianDateTime } from "../../utils/dates";
import { isOpenCommunityGathering } from "../../utils/gatherings";
import { eventPath } from "../../utils/gatheringPresentation";
import { MyPageModel } from "./useMyPage";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
} from "lucide-react";

interface NextChurchEventSectionProps {
  page: MyPageModel;
}

export const NextChurchEventSection: React.FC<NextChurchEventSectionProps> = ({ page }) => {
  const { nextChurchEvent, myTaskInChurchEvent } = page;

  return (
    <section id="section-neste-i-menigheten" className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>Neste i menigheten</span>
        </h2>
        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
          Felles
        </span>
      </div>

      {nextChurchEvent ? (
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                Gudstjeneste & storsamling
              </span>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {nextChurchEvent.title}
              </h3>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-semibold text-slate-900">
                {formatNorwegianDateTime(nextChurchEvent.startsAt)}
              </span>
            </div>
            {nextChurchEvent.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{nextChurchEvent.location}</span>
              </div>
            )}
          </div>

          {/* What the website says about it: picture, text and how to sign up */}
          {isOpenCommunityGathering(nextChurchEvent) && (
            <Link to={eventPath(nextChurchEvent.id)} className="inline-block text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline">
              Se arrangementet på nettsiden
            </Link>
          )}

          {/* Highlight if current user is serving in this service */}
          {myTaskInChurchEvent && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Din oppgave: {myTaskInChurchEvent.title}</span>
              </div>
              <Link
                to={`/oppgave/${myTaskInChurchEvent.id}`}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
              >
                Se oppgave
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 text-center text-xs text-slate-400">
          Ingen fellesarrangementer planlagt for øyeblikket.
        </div>
      )}
    </section>
  );
};
