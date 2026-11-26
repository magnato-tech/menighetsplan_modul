import React from "react";
import { formatNorwegianDateTime } from "../../utils/dates";
import type { LeaderGroupDetail } from "./leaderGroupDetail";

interface GroupActivitiesUndistributedProps {
  tasks: LeaderGroupDetail["undistributedTasks"];
  takeTask: LeaderGroupDetail["takeTask"];
  showToast: (text: string) => void;
}

// The «Ikke fordelt» section: shared tasks that no team has taken yet
export const GroupActivitiesUndistributed: React.FC<GroupActivitiesUndistributedProps> = ({ tasks, takeTask, showToast }) => {
  return (
    <section id="group-undistributed" className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2.5">
      <div className="space-y-0.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">Ikke fordelt ({tasks.length})</h3>
        <p className="text-[11px] text-amber-800">Disse oppgavene deles med et annet team. Ta dem gruppen deres skal ha.</p>
      </div>
      <div className="space-y-2">
        {tasks.map(({ task, gathering, teamNames }) => (
          <div
            key={task.id}
            id={`group-undistributed-task-${task.id}`}
            className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 flex-wrap text-xs"
          >
            <div className="space-y-0.5">
              <p className="font-bold text-slate-800">{formatNorwegianDateTime(gathering.startsAt)}</p>
              <p className="text-slate-700">
                {gathering.title} – {task.title}
              </p>
              <p className="text-[11px] text-slate-500">Kan gå til: {teamNames.join(", ")}</p>
            </div>
            <button
              type="button"
              id={`btn-take-task-${task.id}`}
              onClick={() => {
                const res = takeTask(task.id);
                if (!res.success) showToast(res.error || "Kunne ikke ta oppgaven.");
              }}
              className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Vi tar denne
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
