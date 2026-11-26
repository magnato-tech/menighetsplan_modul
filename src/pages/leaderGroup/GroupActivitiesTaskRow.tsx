import React from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { formatNorwegianDateTime } from "../../utils/dates";
import type { GroupActivityActions, GroupGathering } from "./groupActivitiesTypes";

interface GroupActivitiesTaskRowProps {
  taskItem: GroupGathering["taskItems"][number];
  gathering: GroupGathering["gathering"];
  actions: GroupActivityActions;
}

// One task inside an expanded gathering card, with its quick-assign drawer
export const GroupActivitiesTaskRow: React.FC<GroupActivitiesTaskRowProps> = ({ taskItem, gathering, actions }) => {
  const { task, assignedPersons, confirmedCount, neededCount, isFullyCovered: taskCovered, hasForfall: taskForfall } = taskItem;
  const {
    hasLeaderAccess,
    members,
    quickAssignTaskId,
    onToggleQuickAssign,
    sameDayOf,
    sameDayTexts,
    quickAssign,
    canGiveBack,
    giveTaskBack,
    volunteerRoles,
    confirm,
    showToast,
  } = actions;

  return (
    <div
      key={task.id}
      id={`group-gathering-task-${task.id}`}
      className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs space-y-2"
    >
      <div className="flex items-center justify-between gap-1">
        <div>
          <span className="font-bold text-slate-800">{task.title}</span>
          <span className="text-[11px] text-slate-500 ml-2">
            ({confirmedCount}/{neededCount} dekket)
          </span>
        </div>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            taskForfall
              ? "bg-red-100 text-red-700"
              : taskCovered
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {taskForfall ? "Forfall" : taskCovered ? "Dekket" : "Mangler"}
        </span>
      </div>

      {/* Assigned persons tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {assignedPersons.length > 0 ? (
          assignedPersons.map(({ assignment, person, response }) => (
            <span
              key={assignment.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                response === "confirmed"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold"
                  : response === "withdrawn"
                  ? "bg-red-50 text-red-800 border border-red-300"
                  : "bg-amber-50 text-amber-800 border border-amber-300"
              }`}
            >
              <span>{person?.name || "Ukjent"}</span>
              {response !== "confirmed" && (
                <span className="text-[9px] font-bold opacity-90">
                  ({response === "withdrawn" ? "Forfall" : response === "declined" ? "Avslått" : "Forespurt"})
                </span>
              )}
              {person && (response === "pending" || response === "confirmed") && sameDayOf(person.id, gathering.startsAt, task.id).length > 0 && (
                <span
                  id={`warn-double-${task.id}-${person.id}`}
                  role="img"
                  title={`Har også: ${sameDayTexts(sameDayOf(person.id, gathering.startsAt, task.id)).join(", ")}`}
                  aria-label={`Har også: ${sameDayTexts(sameDayOf(person.id, gathering.startsAt, task.id)).join(", ")}`}
                  className="inline-flex"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                </span>
              )}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-slate-400 italic">Ingen tildelt</span>
        )}
      </div>

      {/* Give the task back, when its role is shared with other teams */}
      {hasLeaderAccess && canGiveBack(task) && (
        <div className="pt-1 flex items-center justify-between">
          <button
            type="button"
            id={`btn-give-back-${task.id}`}
            onClick={async () => {
              const roleName = volunteerRoles.find((role) => role.id === task.volunteerRoleId)?.name ?? task.title;
              const date = formatNorwegianDateTime(gathering.startsAt);
              const ok = await confirm(`Gi «${roleName}» ${date} tilbake? Da kan de andre teamene ta den.`, { yes: "Gi fra oss" });
              if (!ok) return;
              const res = giveTaskBack(task.id);
              if (!res.success) showToast(res.error || "Kunne ikke gi oppgaven tilbake.");
            }}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
          >
            Gi fra oss
          </button>
        </div>
      )}

      {/* Quick Assign action button */}
      {!taskCovered && hasLeaderAccess && (
        <div className="pt-1 flex items-center justify-between">
          <button
            type="button"
            id={`btn-quick-assign-${task.id}`}
            onClick={() => onToggleQuickAssign(task.id)}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tildel fra gruppen</span>
          </button>
        </div>
      )}

      {/* Quick Assign Dropdown Drawer */}
      {quickAssignTaskId === task.id && (
        <div className="p-2.5 bg-slate-900 text-white rounded-xl space-y-2 mt-1">
          <span className="text-[10px] uppercase font-bold text-amber-400 block">
            Velg deltaker for direkte tildeling:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {members.map((m) => {
              const others = sameDayOf(m.id, gathering.startsAt, task.id);
              const first = others[0];
              return (
              <div
                key={m.id}
                className="p-1.5 bg-slate-800 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span>{m.name}</span>
                  {first && (
                    <span className="block text-[10px] font-semibold text-amber-400">
                      {`har allerede ${first.taskTitle} denne dagen${others.length > 1 ? ` +${others.length - 1} til` : ""}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Tildel: the leader has already agreed it with the person */}
                  <button
                    type="button"
                    id={`btn-do-quick-assign-${task.id}-${m.id}`}
                    onClick={() => quickAssign(task.id, m.id, m.name, "confirmed")}
                    className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold text-white cursor-pointer"
                  >
                    Tildel
                  </button>
                  {/* Forespør: the person answers yes or no */}
                  <button
                    type="button"
                    id={`btn-do-quick-ask-${task.id}-${m.id}`}
                    onClick={() => quickAssign(task.id, m.id, m.name, "pending")}
                    className="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-[10px] font-bold text-slate-100 cursor-pointer"
                  >
                    Forespør
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
