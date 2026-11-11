import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";
import { formatNorwegianDateTime } from "../../utils/dates";
import { upcomingWorshipServices, worshipPlanRows } from "../../utils/worshipPlan";
import { MIN_SIDE_CARD_GRID } from "../../utils/minSideFrame";

// The next worship services, and who has said yes to what. Everyone in the register sees the same,
// as on the run sheet. A press on a service opens its run sheet.

const SERVICES_SHOWN = 6;

export const WorshipPlanPanel: React.FC = () => {
  const navigate = useNavigate();
  const { gatherings, tasks, assignments, volunteerRoles, getPersonById, currentUser, watchGatheringAssignments } = useFirebase();

  const services = useMemo(
    () => upcomingWorshipServices(gatherings, Date.now(), SERVICES_SHOWN),
    [gatherings]
  );

  // The names are asked for where the database gives them, as on the run sheet
  const servicesKey = services.map((service) => service.id).join("|");
  useEffect(() => {
    const stops = services.map((service) => watchGatheringAssignments(service.id));
    return () => stops.forEach((stop) => stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesKey, watchGatheringAssignments]);

  if (services.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200/80">
        Ingen gudstjenester framover
      </div>
    );
  }

  return (
    <div className={MIN_SIDE_CARD_GRID}>
      {services.map((service) => {
        const rows = worshipPlanRows({
          gathering: service,
          tasks,
          assignments,
          volunteerRoles,
          personName: (personId) => getPersonById(personId)?.name,
          me: currentUser.id,
        });
        return (
          <button
            key={service.id}
            type="button"
            onClick={() => navigate(`/samling/${service.id}`)}
            className="w-full text-left bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5 hover:border-slate-300 hover:shadow-sm transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">{service.title}</div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                  {formatNorwegianDateTime(service.startsAt)}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
            </div>

            {rows.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                {rows.map((row) => (
                  <div key={row.taskId} className="flex items-start gap-2 text-xs">
                    <span className={`min-w-0 flex-1 ${row.isMine ? "font-bold text-slate-900" : "text-slate-700"}`}>
                      <span>{row.role}</span>
                      {/* Nobody has said yes: one dash, not a separator and a dash */}
                      <span className="text-slate-400">{row.people.length === 0 ? " –" : " — "}</span>
                      {row.people.length === 0 ? null : (
                        row.people.map((person, index) => (
                          <span key={person.personId}>
                            {index > 0 && ", "}
                            <span className={person.isMe ? "font-bold text-slate-900" : ""}>{person.name}</span>
                          </span>
                        ))
                      )}
                    </span>
                    {row.isMine && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Du</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
