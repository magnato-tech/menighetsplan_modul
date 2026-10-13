import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import type { Task } from "../../types";
import { formatNorwegianDateTime } from "../../utils/dates";
import type { MyPageModel } from "./useMyPage";

/** The tasks the person has said yes to and that lie ahead, the nearest first: what a volunteer comes to Min side for. */
export const MyTasksTab: React.FC<{ page: MyPageModel }> = ({ page }) => {
  const { myTasks, getGatheringById } = page;
  const gatheringOf = (task: Task) => getGatheringById(task.gatheringId);

  return (
    <section id="section-mine-oppgaver" aria-label="Mine oppgaver" className="space-y-2.5">
      {myTasks.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">Du har ingen oppgaver framover</p>
          <p>Oppgaver du sier ja til, står her.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {myTasks.map((task) => {
            const gathering = gatheringOf(task);
            return (
              <li key={task.id}>
                <Link
                  to={`/oppgave/${task.id}`}
                  className="block p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-slate-900">{task.title}</p>
                      {/* Two tasks may have the same title, so each says which event it is on */}
                      {gathering && (
                        <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            <span className="font-semibold text-slate-800">{formatNorwegianDateTime(gathering.startsAt)}</span> · {gathering.title}
                          </span>
                        </p>
                      )}
                      {task.description && <p className="text-xs text-slate-600">{task.description}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
