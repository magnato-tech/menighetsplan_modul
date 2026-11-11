import React from "react";
import { Clock, MapPin } from "lucide-react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { locationOf } from "../../utils/gatherings";
import { repeatsTitle } from "../../utils/labels";
import { StaffingDotMark } from "../../components/gathering/StaffingDotMark";
import type { PersonalCalendarEvent } from "../../utils/personalCalendar";
import type { StaffingDot } from "../../utils/staffing";

interface MyCalendarListProps {
  events: PersonalCalendarEvent[];
  /** The staffing dot of each event, when the person has one to see. */
  dots: ReadonlyMap<string, StaffingDot | null>;
  onOpen: (gatheringId: string) => void;
}

/** The calendar as a list of cards, one card for each event. Shown on a phone; a month view takes over from a tablet. */
export const MyCalendarList: React.FC<MyCalendarListProps> = ({ events, dots, onOpen }) => {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200/80">
        <p className="font-bold text-slate-700">Ingen hendelser framover</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        // The group an event belongs to is only said when the title does not say it already
        const label = event.source === "menigheten" ? "Menigheten" : event.groupName || "Gruppe";
        const dot = dots.get(event.gathering.id);
        return (
          <button
            key={event.gathering.id}
            type="button"
            onClick={() => onOpen(event.gathering.id)}
            className={`w-full text-left p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 hover:border-emerald-300 transition-colors cursor-pointer ${
              event.gathering.cancelled ? "opacity-75 bg-red-50/30 border-red-100" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                {!repeatsTitle(label, event.gathering.title) && (
                  <span
                    className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      event.source === "menigheten" ? "text-emerald-800 bg-emerald-50 border-emerald-100" : "text-slate-700 bg-slate-100 border-slate-200"
                    }`}
                  >
                    {label}
                  </span>
                )}
                <h2 className="text-sm font-bold text-slate-900 leading-snug">{event.gathering.title}</h2>
              </div>
              {event.gathering.cancelled ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                  Avlyst
                </span>
              ) : (
                dot && (
                  <span className="shrink-0 pt-1">
                    <StaffingDotMark dot={dot} />
                  </span>
                )
              )}
            </div>

            <div className="space-y-1 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-900">{formatNorwegianDateTime(event.gathering.startsAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{locationOf(event.gathering)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
