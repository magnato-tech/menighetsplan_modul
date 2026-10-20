import React, { useMemo, useState } from "react";
import { X, Search, UserPlus, Send, AlertTriangle } from "lucide-react";
import type { Person } from "../../types";
import { GatheringDetail } from "./gatheringDetail";
import { suggestedLeaderIds } from "../../utils/roleStaffing";
import { holdsSlot } from "../../utils/staffing";
import type { AssignMode } from "./StaffingRosterRowCard";

interface AssignPersonDialogProps {
  detail: GatheringDetail;
  taskId: string;
  /** Tildel puts the person on as confirmed (it is agreed already); Forespør sends a request. */
  mode: AssignMode;
  /** Admins may pick anyone in the congregation; leaders pick among the group's members. */
  canAdminister: boolean;
  showToast: (text: string) => void;
  onClose: () => void;
}

interface Candidate {
  person: Person;
  /** On leave the day of the gathering. */
  away?: string;
  /** Already on another role at the same gathering. */
  otherRole?: string;
  suggested: boolean;
}

/**
 * Picks the person for a role. One press on a name puts them on: as confirmed (Tildel) or asked
 * (Forespør), whichever button opened the sheet. The role's team comes first. On a phone it comes
 * up from the bottom, where the thumb is.
 */
export const AssignPersonDialog: React.FC<AssignPersonDialogProps> = ({
  detail,
  taskId,
  mode,
  canAdminister,
  showToast,
  onClose,
}) => {
  const { gathering, groupMembers, membersOf, allPersons, tasksWithDetails, assignTaskToPerson } = detail;
  const [query, setQuery] = useState("");

  const activeTask = tasksWithDetails.find((td) => td.task.id === taskId);
  const taskGroup = activeTask?.taskGroup;
  const roleTitle = activeTask?.task.title ?? "oppgaven";

  const { team, others } = useMemo(() => {
    const onThisTask = new Set(activeTask?.assignedPersons.filter((p) => holdsSlot(p.assignment)).map((p) => p.assignment.personId));
    const leaderIds = new Set(suggestedLeaderIds(taskGroup));
    const day = gathering?.startsAt ? gathering.startsAt.split("T")[0] : "";
    // Who already holds another role at this gathering
    const otherRoles = new Map<string, string>();
    for (const td of tasksWithDetails) {
      if (td.task.id === taskId) continue;
      for (const p of td.assignedPersons) if (holdsSlot(p.assignment)) otherRoles.set(p.assignment.personId, td.task.title);
    }
    const teamPeople = taskGroup ? membersOf(taskGroup) : canAdminister ? [] : groupMembers;
    const teamIds = new Set(teamPeople.map((p) => p.id));
    const q = query.trim().toLowerCase();
    const matches = (p: Person) => !q || p.name.toLowerCase().includes(q) || Boolean(p.email?.toLowerCase().includes(q));
    const toCandidate = (person: Person): Candidate => {
      const period = day ? person.unavailablePeriods?.find((p) => day >= p.from && day <= p.to) : undefined;
      return {
        person,
        away: period ? period.reason || "Borte" : undefined,
        otherRole: otherRoles.get(person.id),
        suggested: leaderIds.has(person.id),
      };
    };
    // Available first, then those on another role, then those away; suggested leaders first within each
    const rank = (c: Candidate) => (c.away ? 2 : c.otherRole ? 1 : 0);
    const sort = (list: Candidate[]) =>
      list.sort(
        (a, b) =>
          rank(a) - rank(b) || Number(b.suggested) - Number(a.suggested) || a.person.name.localeCompare(b.person.name, "nb")
      );
    const pick = (list: Person[]) => sort(list.filter((p) => !onThisTask.has(p.id) && matches(p)).map(toCandidate));
    return {
      team: pick(teamPeople),
      others: canAdminister ? pick(allPersons.filter((p) => !teamIds.has(p.id))) : [],
    };
  }, [activeTask, taskGroup, gathering, tasksWithDetails, taskId, membersOf, canAdminister, groupMembers, allPersons, query]);

  const choose = (person: Person) => {
    const res = assignTaskToPerson(taskId, person.id, mode);
    if (res.success) {
      onClose();
      showToast(mode === "confirmed" ? `${person.name} er tildelt ${roleTitle}.` : `${person.name} er forespurt som ${roleTitle}.`);
    } else {
      showToast(res.error || "Kunne ikke lagre.");
    }
  };

  const renderList = (list: Candidate[]) =>
    list.map(({ person, away, otherRole, suggested }) => (
      <li key={person.id}>
        <button
          type="button"
          onClick={() => choose(person)}
          className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
            away ? "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70" : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-900 truncate">
              {person.name}
              {suggested && <span className="ml-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Leder</span>}
            </span>
            {(away || otherRole) && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold ${away ? "text-amber-800" : "text-slate-500"}`}>
                {away && <AlertTriangle className="w-3 h-3" aria-hidden />}
                {away ? `Borte: ${away}` : `Står på ${otherRole}`}
              </span>
            )}
          </span>
          {mode === "confirmed" ? (
            <UserPlus className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
          ) : (
            <Send className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
          )}
        </button>
      </li>
    ));

  return (
    <div
      id="modal-assign-person"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-person-title"
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-4 space-y-3 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="assign-person-title" className="text-base font-extrabold text-slate-900 leading-tight truncate">
              {mode === "confirmed" ? "Tildel" : "Forespør"}: {roleTitle}
            </h3>
            <p className="text-xs text-slate-500">
              {mode === "confirmed" ? "Velg personen som har sagt ja." : "Personen får forespørselen på Min side."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk etter navn"
            aria-label="Søk etter navn"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-y-auto -mx-1 px-1 space-y-3 flex-1 min-h-0">
          {team.length === 0 && others.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">Ingen personer passer søket.</p>
          ) : (
            <>
              {team.length > 0 && (
                <section className="space-y-1.5">
                  {canAdminister && (
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{taskGroup?.name ?? "Teamet"}</h4>
                  )}
                  <ul className="space-y-1.5">{renderList(team)}</ul>
                </section>
              )}
              {others.length > 0 && (
                <section className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {team.length > 0 || taskGroup ? "Andre i menigheten" : "Menigheten"}
                  </h4>
                  <ul className="space-y-1.5">{renderList(others)}</ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
