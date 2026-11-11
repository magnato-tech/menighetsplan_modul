import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebase } from "../../context/FirebaseDataContext";
import { useCurrentUser } from "../../hooks/memberHooks";
import { useMinSideModules } from "../../hooks/useMinSideModules";
import { leadsGroup } from "../../utils/groups";
import { MyCalendarList } from "./MyCalendarList";
import { MyCalendarMonth } from "./MyCalendarMonth";
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
  { id: "jeg_leder", label: "Jeg leder" },
];

/**
 * The tab «Kalender» on Min side: what lies ahead in the congregation and in one's own groups.
 * The filters and the events stand right on the page; the page's heading says what it is.
 */
export const MyCalendarPanel: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userGroups } = useCurrentUser();
  const { gatherings, getPersonAttendance, tasks, assignments, watchGatheringAssignments } = useFirebase();
  const { isOn } = useMinSideModules();
  const staffingOn = isOn("tjeneste");
  const [filter, setFilter] = useState<PersonalCalendarFilter>("alle");
  const openGathering = (gatheringId: string) => navigate(`/samling/${gatheringId}`);

  const from = useMemo(() => Date.now(), []);

  const allEvents = useMemo(
    () =>
      personalCalendarEvents(gatherings, userGroups, from, (gatheringId) =>
        getPersonAttendance(gatheringId, currentUser.id)
      ),
    [gatherings, userGroups, from, getPersonAttendance, currentUser.id]
  );

  // The groups the user leads or co-leads. Used for the filter «Jeg leder» and for the dots.
  const ledGroupIds = useMemo(
    () => new Set(userGroups.filter((g) => leadsGroup(g, currentUser.id)).map((g) => g.id)),
    [userGroups, currentUser.id]
  );
  const filters = ledGroupIds.size > 0 ? FILTERS : FILTERS.filter((item) => item.id !== "jeg_leder");

  const visibleEvents = useMemo(
    () => filterPersonalCalendarEvents(allEvents, filter, { ledGroupIds, tasks }),
    [allEvents, filter, ledGroupIds, tasks]
  );

  // A group leader sees a dot where the groups they lead lack people (red) or are not full (yellow).
  // Only with the module «tjeneste»: then the assignments are watched too.
  const watchedIds = useMemo(
    () => (staffingOn ? gatheringsNeedingAssignments(allEvents.map((e) => e.gathering.id), tasks, ledGroupIds) : []),
    [staffingOn, allEvents, tasks, ledGroupIds]
  );
  const watchedKey = watchedIds.join("|");
  useEffect(() => {
    const stops = watchedIds.map((id) => watchGatheringAssignments(id));
    return () => stops.forEach((stop) => stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKey, watchGatheringAssignments]);
  const dots = useMemo(
    () =>
      new Map(
        visibleEvents.map((e) => [
          e.gathering.id,
          staffingOn ? leaderDotForGathering(e.gathering, tasks, assignments, ledGroupIds) : null,
        ])
      ),
    [staffingOn, visibleEvents, tasks, assignments, ledGroupIds]
  );

  // No subscription is offered here: the personal calendar file needs a service that reads what
  // only the person may read, and none runs where the app is hosted (PRODUKTDOKUMENTASJON.md
  // chapter 13). What it would be made from, is kept in utils/personalCalendar.ts.

  return (
    <section id="section-min-kalender" aria-label="Kalender" className="space-y-3">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 w-full">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`flex-1 px-1 py-2 rounded-lg text-[11px] sm:text-xs whitespace-nowrap font-bold transition-colors cursor-pointer ${
              filter === item.id ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
            aria-pressed={filter === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="sm:hidden">
        <MyCalendarList events={visibleEvents} dots={dots} onOpen={openGathering} />
      </div>
      <div className="hidden sm:block">
        <MyCalendarMonth events={visibleEvents} dots={dots} onOpen={openGathering} />
      </div>
    </section>
  );
};
