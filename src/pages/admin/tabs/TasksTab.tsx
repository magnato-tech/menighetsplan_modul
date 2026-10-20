import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatNorwegianDateTime,
  AdminTaskItem,
} from "../../../hooks/useAppHooks";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Send,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import {
  StudioData,
  ShowFeedback,
  NEAR_WEEKS,
  followUpGroups,
  taskStateOf,
  type FollowUpFilter,
} from "../studio";
import { ROSTER_STATE_LABELS, type RosterState } from "../../../utils/staffingRoster";
import { isAcuteForfall } from "../../../utils/staffing";

interface TasksTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

const STATE_STYLE: Record<RosterState, string> = {
  forfall: "text-rose-300 bg-rose-950/80 border-rose-800",
  ubesatt: "text-rose-300 bg-rose-950/80 border-rose-800",
  venter: "text-amber-300 bg-amber-950/80 border-amber-800",
  dekket: "text-emerald-300 bg-emerald-950/80 border-emerald-800",
  avlyst: "text-[var(--studio-muted)] bg-[var(--studio-bg)] border-[var(--studio-border)]",
};

const StateBadge: React.FC<{ state: RosterState }> = ({ state }) => {
  const Icon = state === "dekket" ? CheckCircle2 : state === "venter" ? Clock : AlertTriangle;
  return (
    <span className={`text-[10px] font-bold border px-2 py-0.5 rounded flex items-center gap-1 ${STATE_STYLE[state]}`}>
      <Icon className="w-3 h-3" aria-hidden />
      {ROSTER_STATE_LABELS[state]}
    </span>
  );
};

/**
 * «Trenger oppfølging»: what must be ordered on the gatherings ahead, per gathering and soonest
 * first. The nearest weeks show first; further out, an empty slot is planning, not an emergency.
 */
export const TasksTab: React.FC<TasksTabProps> = ({ studio, showFeedback }) => {
  const { allPersons, adminTasks, assignTaskToPerson } = studio;
  const [filter, setFilter] = useState<FollowUpFilter>("ordnes");
  const [weeks, setWeeks] = useState<number | null>(NEAR_WEEKS);
  const groups = followUpGroups(adminTasks, filter, weeks);
  const countFor = (f: FollowUpFilter) => followUpGroups(adminTasks, f, weeks).reduce((sum, g) => sum + g.items.length, 0);

  // Tildel / Forespør
  const [assigningTaskItem, setAssigningTaskItem] = useState<AdminTaskItem | null>(null);
  const [selectedPersonIdToAssign, setSelectedPersonIdToAssign] = useState("");
  const [assignMode, setAssignMode] = useState<"confirmed" | "pending">("confirmed");

  const handleExecuteAssign = () => {
    if (!assigningTaskItem || !selectedPersonIdToAssign) {
      showFeedback("Velg en person", "error");
      return;
    }
    const res = assignTaskToPerson(assigningTaskItem.task.id, selectedPersonIdToAssign, assignMode);
    if (res.success) {
      showFeedback(assignMode === "confirmed" ? "Personen er tildelt." : "Forespørselen er sendt.");
      setAssigningTaskItem(null);
      setSelectedPersonIdToAssign("");
    } else {
      showFeedback(res.error || "Kunne ikke lagre.", "error");
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
      active ? "bg-indigo-600 text-white" : "bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:bg-[var(--studio-hover)]"
    }`;

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="border-b border-[var(--studio-border)] pb-4">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Trenger oppfølging</h2>
          <p className="text-xs text-[var(--studio-muted)]">Forfall og ubesatte oppgaver på arrangementene som kommer, det nærmeste først.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilter("ordnes")} className={chip(filter === "ordnes")}>
            Må ordnes ({countFor("ordnes")})
          </button>
          <button type="button" onClick={() => setFilter("venter")} className={chip(filter === "venter")}>
            Venter på svar ({countFor("venter")})
          </button>
          <button type="button" onClick={() => setFilter("alle")} className={chip(filter === "alle")}>
            Alle ({countFor("alle")})
          </button>
          <span className="w-px h-5 bg-[var(--studio-border)] mx-1" aria-hidden />
          <button type="button" onClick={() => setWeeks(NEAR_WEEKS)} className={chip(weeks !== null)}>
            {NEAR_WEEKS} uker
          </button>
          <button type="button" onClick={() => setWeeks(null)} className={chip(weeks === null)}>
            Alt som kommer
          </button>
        </div>

        {groups.length === 0 && (
          <div className="p-8 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-center space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" aria-hidden />
            <p className="text-sm font-bold text-[var(--studio-text)]">
              {filter === "ordnes" ? "Ingenting må ordnes" : filter === "venter" ? "Ingen venter på svar" : "Ingen oppgaver"}
              {weeks !== null ? ` de neste ${weeks} ukene` : ""}
            </p>
          </div>
        )}

        <div className="space-y-5">
          {groups.map((group) => {
            const g = group.gathering;
            return (
              <section key={g?.id ?? "uten-arrangement"} className="space-y-2">
                {g ? (
                  <Link
                    to={`/admin/samling/${g.id}?vis=bemanning`}
                    className="flex items-center justify-between gap-3 px-1 group"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[var(--studio-text)] truncate group-hover:underline">{g.title}</span>
                      <span className="block text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(g.startsAt)}</span>
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[var(--studio-icon)]">
                      Bemanning
                      <ChevronRight className="w-4 h-4" aria-hidden />
                    </span>
                  </Link>
                ) : (
                  <h3 className="px-1 text-sm font-black text-[var(--studio-text)]">Uten arrangement</h3>
                )}

                {group.items.map((item) => {
                  const task = item.task;
                  const state = taskStateOf(item);
                  const acute = (state === "forfall" || state === "ubesatt") && isAcuteForfall(g?.startsAt, new Date());
                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border bg-[var(--studio-surface)] ${
                        acute ? "border-rose-600/80" : state === "forfall" || state === "ubesatt" ? "border-rose-900/60" : state === "venter" ? "border-amber-900/60" : "border-[var(--studio-border)]"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[var(--studio-text)] text-base">{task.title}</h4>
                            <StateBadge state={state} />
                            {acute && (
                              <span className="text-[10px] font-black text-rose-300 bg-rose-950 border border-rose-600 px-2 py-0.5 rounded flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" aria-hidden />
                                Under 48 t
                              </span>
                            )}
                            {item.neededCount > 1 && item.confirmedCount > 0 && (
                              <span className="text-[10px] font-semibold text-[var(--studio-muted)]">
                                {item.confirmedCount}/{item.neededCount} bekreftet
                              </span>
                            )}
                          </div>

                          {item.assignedPersonsList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {item.assignedPersonsList.map((ap) => (
                                <span
                                  key={ap.assignment.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs ${
                                    ap.response === "confirmed"
                                      ? "bg-emerald-950/70 border-emerald-800 text-emerald-300 font-bold"
                                      : ap.response === "withdrawn" || ap.response === "declined"
                                      ? "bg-rose-950/80 border-rose-800 text-rose-300"
                                      : "bg-amber-950/70 border-amber-800 text-amber-300"
                                  }`}
                                >
                                  {ap.person?.name || ap.assignment.personName || "Ukjent person"}
                                  {ap.response !== "confirmed" && <span className="text-[10px] opacity-80">{ap.statusLabel}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                          {item.availableSpots > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningTaskItem(item);
                                  setSelectedPersonIdToAssign("");
                                  setAssignMode("confirmed");
                                }}
                                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" aria-hidden />
                                <span>Tildel</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningTaskItem(item);
                                  setSelectedPersonIdToAssign("");
                                  setAssignMode("pending");
                                }}
                                className="px-3 py-2 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] font-bold flex items-center gap-1.5 border border-[var(--studio-border)] cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" aria-hidden />
                                <span>Forespør</span>
                              </button>
                            </>
                          )}
                          <Link
                            to={`/admin/oppgave/${task.id}`}
                            className="px-3 py-2 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] font-medium"
                          >
                            Rediger
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 2: TILDEL ELLER FORESPØR FRIVILLIG                  */}
      {/* ========================================================= */}
      {assigningTaskItem && (
        <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    assignMode === "confirmed"
                      ? "bg-emerald-950/80 border border-emerald-700/80 text-emerald-400"
                      : "bg-amber-950/80 border border-amber-700/80 text-amber-400"
                  }`}
                >
                  {assignMode === "confirmed" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--studio-text)]">
                    {assignMode === "confirmed" ? "Tildel oppgave (Bekreftet)" : "Forespør frivillig (Venter på svar)"}
                  </h3>
                  <p className="text-[11px] text-[var(--studio-muted)]">
                    {assigningTaskItem.task.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTaskItem(null)}
                className="text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle switch between Tildel vs Forespør */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-xs">
              <button
                type="button"
                onClick={() => setAssignMode("confirmed")}
                className={`py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  assignMode === "confirmed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tildel direkte</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignMode("pending")}
                className={`py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  assignMode === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Forespør</span>
              </button>
            </div>

            <div className="text-xs text-[var(--studio-muted)] space-y-1">
              <p>
                {assignMode === "confirmed"
                  ? "Setter status umiddelbart til Bekreftet. Brukes når du allerede har avtalt vakten muntlig med personen."
                  : "Setter status til Venter på svar og sender en forespørsel til personen."}
              </p>
              <p className="text-[11px] text-[var(--studio-muted)] font-mono">
                Ledige plasser på oppgaven: {assigningTaskItem.availableSpots} av {assigningTaskItem.neededCount}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-[var(--studio-muted)]">Velg person fra personregisteret</label>
              <select
                value={selectedPersonIdToAssign}
                onChange={(e) => setSelectedPersonIdToAssign(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden focus:border-indigo-500 text-xs cursor-pointer"
              >
                <option value="">-- Velg person --</option>
                {allPersons.map((p) => {
                  const isAlreadyAssigned = assigningTaskItem.assignedPersonsList.some(
                    (ap) => ap.person?.id === p.id
                  );
                  const isUnavailable = p.unavailablePeriods && p.unavailablePeriods.length > 0;
                  return (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={isAlreadyAssigned}
                    >
                      {p.name} {isAlreadyAssigned ? "(Allerede på oppgaven)" : ""} {isUnavailable ? "⚠️ Fravær registrert" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAssigningTaskItem(null)}
                className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-xs font-semibold cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleExecuteAssign}
                disabled={!selectedPersonIdToAssign}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all ${
                  !selectedPersonIdToAssign
                    ? "opacity-50 cursor-not-allowed bg-[var(--studio-hover)]"
                    : assignMode === "confirmed"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {assignMode === "confirmed" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Fullfør tildeling</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send forespørsel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
