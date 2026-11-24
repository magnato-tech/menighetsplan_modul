import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronDown } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";
import { formatNorwegianDateTime } from "../../utils/dates";
import { upcomingWorshipServices, worshipPlanRows, worshipServiceActions } from "../../utils/worshipPlan";
import { MIN_SIDE_CARD_GRID } from "../../utils/minSideFrame";

// The next worship services, and who has said yes to what. Everyone in the register sees the same,
// as on the run sheet. A card folds out with its arrow; the nearest service starts open.

const SERVICES_SHOWN = 6;

const ACTION_BUTTON =
  "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer";

export const WorshipPlanPanel: React.FC = () => {
  const navigate = useNavigate();
  const { gatherings, tasks, assignments, volunteerRoles, groups, getPersonById, currentUser, watchGatheringAssignments } = useFirebase();
  // Null until the reader folds a card out or in: then the nearest service is open and the others are closed
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);

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

  const nearestId = services[0].id;
  const open = openIds ?? new Set([nearestId]);
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };
  const isAdmin = currentUser.globalRole === "admin";

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
        const hasTaskThatDay = rows.some((row) => row.isMine);
        const actions = worshipServiceActions({
          gathering: service,
          tasks,
          groups,
          personId: currentUser.id,
          isAdmin,
          hasTaskThatDay,
        });
        const planningPath = actions.planningPath;
        const isOpen = open.has(service.id);
        const panelId = `gudstjeneste-${service.id}`;

        return (
          <div key={service.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(service.id)}
              className="w-full text-left p-3.5 flex items-start gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm lg:text-base font-bold text-slate-900">{service.title}</div>
                <div className="flex items-center gap-1 text-xs lg:text-sm text-slate-500 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                  {formatNorwegianDateTime(service.startsAt)}
                </div>
              </div>
              {/* Folded in, the card still says that the reader has a task that day */}
              {!isOpen && hasTaskThatDay && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 mt-0.5">Du</span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div id={panelId} className="px-3.5 pb-3.5 space-y-2.5">
                {rows.length > 0 && (
                  <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                    {rows.map((row) => (
                      <div key={row.taskId} className="flex items-start gap-2 text-xs lg:text-sm">
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

                {(actions.runSheet || planningPath) && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2.5">
                    {actions.runSheet && (
                      <button type="button" className={ACTION_BUTTON} onClick={() => navigate(`/samling/${service.id}?fra=gudstjenester`)}>
                        Kjøreplan
                      </button>
                    )}
                    {planningPath && (
                      <button type="button" className={ACTION_BUTTON} onClick={() => navigate(planningPath)}>
                        Planlegg
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
