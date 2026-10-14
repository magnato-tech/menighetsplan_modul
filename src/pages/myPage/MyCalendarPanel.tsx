import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, MapPin } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";
import { useCurrentUser } from "../../hooks/memberHooks";
import { formatNorwegianDateTime } from "../../utils/dates";
import { locationOf } from "../../utils/gatherings";
import { repeatsTitle } from "../../utils/labels";
import { leadsGroup } from "../../utils/groups";
import { StaffingDotMark } from "../../components/gathering/StaffingDotMark";
import {
  filterPersonalCalendarEvents,
  gatheringsNeedingAssignments,
  leaderDotForGathering,
  personalCalendarEvents,
  PersonalCalendarFilter,
} from "../../utils/personalCalendar";

const FILTERS: { id: PersonalCalendarFilter; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "menigheten", label: "Menigheten" },
  { id: "mine_grupper", label: "Mine grupper" },
];

/**
 * The tab «Kalender» on Min side: what lies ahead in the congregation and in one's own groups.
 * The filters and the events stand right on the page; the page's heading says what it is.
 */
export const MyCalendarPanel: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userGroups } = useCurrentUser();
  const { gatherings, getPersonAttendance, tasks, assignments, watchGatheringAssignments } = useFirebase();
  const [filter, setFilter] = useState<PersonalCalendarFilter>("alle");

  const from = useMemo(() => Date.now(), []);

  const allEvents = useMemo(
    () =>
      personalCalendarEvents(gatherings, userGroups, from, (gatheringId) =>
        getPersonAttendance(gatheringId, currentUser.id)
      ),
    [gatherings, userGroups, from, getPersonAttendance, currentUser.id]
  );

  const visibleEvents = useMemo(
    () => filterPersonalCalendarEvents(allEvents, filter),
    [allEvents, filter]
  );

  // A group leader sees a dot where the groups they lead lack people (red) or are not full (yellow)
  const ledGroupIds = useMemo(
    () => new Set(userGroups.filter((g) => leadsGroup(g, currentUser.id)).map((g) => g.id)),
    [userGroups, currentUser.id]
  );
  const watchedIds = useMemo(
    () => gatheringsNeedingAssignments(allEvents.map((e) => e.gathering.id), tasks, ledGroupIds),
    [allEvents, tasks, ledGroupIds]
  );
  const watchedKey = watchedIds.join("|");
  useEffect(() => {
    const stops = watchedIds.map((id) => watchGatheringAssignments(id));
    return () => stops.forEach((stop) => stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKey, watchGatheringAssignments]);
  const dots = useMemo(
    () => new Map(visibleEvents.map((e) => [e.gathering.id, leaderDotForGathering(e.gathering, tasks, assignments, ledGroupIds)])),
    [visibleEvents, tasks, assignments, ledGroupIds]
  );

  // No subscription is offered here: the personal calendar file needs a service that reads what
  // only the person may read, and none runs where the app is hosted (PRODUKTDOKUMENTASJON.md
  // chapter 13). What it would be made from, is kept in utils/personalCalendar.ts.

  return (
    <section id="section-min-kalender" aria-label="Kalender" className="space-y-3">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 w-full">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filter === item.id ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
            aria-pressed={filter === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200/80">
          <p className="font-bold text-slate-700">Ingen hendelser framover</p>
        </div>
      ) : (
        visibleEvents.map((event) => {
          // The group an event belongs to is only said when the title does not say it already
          const label = event.source === "menigheten" ? "Menigheten" : event.groupName || "Gruppe";
          return (
            <button
              key={event.gathering.id}
              type="button"
              onClick={() => navigate(`/samling/${event.gathering.id}`)}
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
                  dots.get(event.gathering.id) && (
                    <span className="shrink-0 pt-1">
                      <StaffingDotMark dot={dots.get(event.gathering.id)!} />
                    </span>
                  )
                )}
              </div>

              <div className="space-y-1 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-900">
                    {formatNorwegianDateTime(event.gathering.startsAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{locationOf(event.gathering)}</span>
                </div>
              </div>
            </button>
          );
        })
      )}
    </section>
  );
};
