import React, { useState, useMemo } from "react";
import { X, Search } from "lucide-react";
import { GatheringDetail } from "./gatheringDetail";
import { suggestedLeaderIds } from "../../utils/roleStaffing";

interface AssignPersonDialogProps {
  detail: GatheringDetail;
  taskId: string;
  /** Admins may pick anyone in the congregation; leaders pick among the group's members. */
  canAdminister: boolean;
  showToast: (text: string) => void;
  onClose: () => void;
}

export const AssignPersonDialog: React.FC<AssignPersonDialogProps> = ({
  detail,
  taskId,
  canAdminister,
  showToast,
  onClose,
}) => {
  const { gathering, groupMembers, membersOf, allPersons, tasksWithDetails, assignTaskToPerson } = detail;

  const [personSearchQuery, setPersonSearchQuery] = useState<string>("");

  const activeTaskDetail = tasksWithDetails.find((td) => td.task.id === taskId);
  const taskGroup = activeTaskDetail?.taskGroup;
  const leaderIds = new Set(suggestedLeaderIds(taskGroup));

  const availablePersonsForModal = useMemo(() => {
    if (!taskId) return [];
    const assignedIds = activeTaskDetail ? activeTaskDetail.assignedPersons.map((p) => p.person?.id) : [];
    // A leader assigns from the group the task belongs to, which may be another of the groups they lead
    const pool = canAdminister ? allPersons : taskGroup ? membersOf(taskGroup) : groupMembers;

    const filtered = pool
      .filter((p) => !assignedIds.includes(p.id))
      .filter((p) => {
        if (!personSearchQuery.trim()) return true;
        const q = personSearchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q));
      });

    return [...filtered].sort((a, b) => {
      const aLeader = leaderIds.has(a.id) ? 0 : 1;
      const bLeader = leaderIds.has(b.id) ? 0 : 1;
      if (aLeader !== bLeader) return aLeader - bLeader;
      return a.name.localeCompare(b.name, "nb");
    });
  }, [taskId, activeTaskDetail, canAdminister, allPersons, groupMembers, membersOf, taskGroup, personSearchQuery, leaderIds]);

  const handleAssignPerson = (
    assignTaskId: string,
    personId: string,
    personName: string,
    response: "confirmed" | "pending" = "pending"
  ) => {
    const res = assignTaskToPerson(assignTaskId, personId, response);
    if (res.success) {
      onClose();
      setPersonSearchQuery("");
      showToast(`Oppgaven ble ${response === "confirmed" ? "tildelt" : "forespurt til"} ${personName}!`);
    } else {
      showToast(res.error || "Kunne ikke tildele oppgaven.");
    }
  };

  return (
    <div
      id="modal-assign-person"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={() => onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Bemanning
            </span>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
              Sett person på oppgaven
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={personSearchQuery}
            onChange={(e) => setPersonSearchQuery(e.target.value)}
            placeholder="Søk etter navn eller e-post..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {availablePersonsForModal.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Ingen personer matcher søket.</div>
          ) : (
            availablePersonsForModal.map((person) => {
              const gatheringDate = gathering?.startsAt ? gathering.startsAt.split("T")[0] : "";
              const matchingPeriod = person.unavailablePeriods?.find(
                (p) => gatheringDate >= p.from && gatheringDate <= p.to
              );
              const isUnavailable = Boolean(matchingPeriod);
              const isSuggestedLeader = leaderIds.has(person.id);

              return (
                <div
                  key={person.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                    isUnavailable
                      ? "bg-amber-50/80 border-amber-200"
                      : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/60"
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">
                      {person.name}
                      {isSuggestedLeader && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          Forslag
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {person.email || person.phone || person.globalRole}
                    </span>
                    {isUnavailable && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        ⚠️ Bortreist: {matchingPeriod?.reason || "Ferie"} ({matchingPeriod?.from} -{" "}
                        {matchingPeriod?.to})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAssignPerson(taskId, person.id, person.name, "pending")}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Send forespørsel"
                    >
                      Forespør
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignPerson(taskId, person.id, person.name, "confirmed")}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-[10px] rounded-lg transition-colors cursor-pointer"
                      title="Tildel direkte når personen allerede er spurt"
                    >
                      Tildel
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">
            {canAdminister ? "Viser personer i menigheten" : `Viser deltakere i ${taskGroup?.name || "gruppen"}`}
          </span>
          <button
            type="button"
            onClick={() => onClose()}
            className="text-xs text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
};
