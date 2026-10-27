import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Link2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { deleteSemesterPlan, saveSemesterPlan, subscribeAllSemesterAnswers } from "../../../services/semesterPlans";
import { useSemesterPlans } from "../../../hooks/useSemesterPlans";
import {
  PLAN_STATUS_LABELS,
  formatDay,
  planPersonIds,
  planStatus,
  planSummary,
  semesterPlanPath,
  type SemesterAnswer,
  type SemesterPlan,
} from "../../../utils/semesterPlan";
import { parseIsoToDateAndTime } from "../../../utils/dates";
import { SemesterPlanFormCard } from "../SemesterPlanFormCard";
import { studioTabUrl, type ShowFeedback, type StudioData } from "../studio";
import { studioCardPadded, studioPrimaryButton, studioSecondaryButton } from "../studioTheme";

interface SemesterPlanTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

const STATUS_COLORS = {
  planlagt: "bg-sky-100 text-sky-900",
  apen: "bg-emerald-100 text-emerald-900",
  lukket: "bg-slate-200 text-slate-700",
} as const;

/** "27.10.2026 kl. 18:00" */
function formatOpens(opensAt: string): string {
  const { date, time } = parseIsoToDateAndTime(opensAt);
  return `${formatDay(date)} kl. ${time}`;
}

/**
 * «Semesterplan», opened from the calendar: the administrator releases the planning of a semester.
 * Everyone in a team with tasks in it gets a flag on Min side when it opens, and goes through the
 * events one at a time (see utils/semesterPlan.ts).
 */
export const SemesterPlanTab: React.FC<SemesterPlanTabProps> = ({ studio, showFeedback }) => {
  const { adminGatherings, adminTasks, adminGroups } = studio;
  const gatherings = useMemo(() => adminGatherings.map((item) => item.gathering), [adminGatherings]);
  const tasks = useMemo(() => adminTasks.map((item) => item.task), [adminTasks]);
  const groups = useMemo(() => adminGroups.map((item) => item.group), [adminGroups]);

  const { plans, ready } = useSemesterPlans();
  const [answers, setAnswers] = useState<SemesterAnswer[]>([]);
  useEffect(() => subscribeAllSemesterAnswers(setAnswers), []);

  const [editing, setEditing] = useState<{ plan?: SemesterPlan; reopen?: boolean } | null>(null);
  const now = new Date();

  const save = async (plan: SemesterPlan) => {
    const saved = await saveSemesterPlan(plan);
    if (saved) {
      showFeedback(
        editing?.plan && !editing.reopen ? "Semesterplanen er endret" : `Semesterplanen er frigitt. Den åpner ${formatOpens(plan.opensAt)}.`
      );
    }
    return saved;
  };

  const remove = async (plan: SemesterPlan) => {
    if (!confirm(`Vil du slette semesterplanen «${plan.name}»? Svarene til de frivillige slettes også. Oppgavene de har tatt, blir stående.`)) return;
    if (await deleteSemesterPlan(plan.id)) showFeedback("Semesterplanen ble slettet");
  };

  const copyLink = (plan: SemesterPlan) => {
    const url = `${window.location.origin}${semesterPlanPath(plan.id)}`;
    navigator.clipboard.writeText(url).then(
      () => showFeedback("Lenken er kopiert. Send den på e-post eller i en gruppe."),
      () => showFeedback(`Kunne ikke kopiere. Lenken er ${url}`, "error")
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-3 border-b border-[var(--studio-border)] pb-4">
        <Link
          to={studioTabUrl("planlegger-samlinger")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Kalender
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Semesterplan</h2>
            <p className="text-xs text-[var(--studio-muted)]">
              Frigi planen for et semester. Alle som er med i et team med oppgaver, får et flagg på Min side og går gjennom arrangementene ett om
              gangen: de tar en oppgave, sier fra at de ikke kan, eller går videre. Lag planen når semesterets arrangementer og oppgaver ligger i
              kalenderen.
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing({})}
              className={`${studioPrimaryButton} shrink-0 px-4 py-2 text-xs flex items-center gap-1.5 shadow-sm`}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Ny semesterplan
            </button>
          )}
        </div>
      </div>

      {editing && (
        <SemesterPlanFormCard
          key={`${editing.plan?.id ?? "ny"}-${editing.reopen ? "igjen" : "endre"}`}
          plan={editing.plan}
          reopen={editing.reopen}
          others={plans.filter((other) => other.id !== editing.plan?.id)}
          gatherings={gatherings}
          tasks={tasks}
          groups={groups}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {ready && plans.length === 0 ? (
        <div className={`${studioCardPadded} text-center py-10`}>
          <p className="text-sm font-bold text-[var(--studio-text)]">Ingen semesterplan ennå.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => {
            const status = planStatus(plan, now);
            const summary = planSummary(plan, gatherings, tasks, groups);
            const people = new Set(planPersonIds(plan, gatherings, tasks, groups));
            // Gone through in this round: an answer from before the plan was opened again does not count
            const finished = answers.filter(
              (answer) => answer.planId === plan.id && answer.round === plan.opensAt && answer.finishedAt && people.has(answer.personId)
            ).length;
            return (
              <li key={plan.id} className={`${studioCardPadded} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-[var(--studio-text)]">{plan.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${STATUS_COLORS[status]}`}>{PLAN_STATUS_LABELS[status]}</span>
                  </div>
                  <p className="text-xs text-[var(--studio-muted)]">
                    {formatDay(plan.firstDay)}–{formatDay(plan.lastDay)} · Svarfrist {formatDay(plan.answerBy)}
                  </p>
                  <p className="text-xs text-[var(--studio-muted)]">Åpner {formatOpens(plan.opensAt)}</p>
                  <p className="text-xs font-bold text-[var(--studio-text)]">
                    {summary.gatheringCount} {summary.gatheringCount === 1 ? "arrangement" : "arrangementer"} · {summary.personCount}{" "}
                    {summary.personCount === 1 ? "person får" : "personer får"} flagget
                    {status !== "planlagt" && summary.personCount > 0 && ` · ${finished} av ${summary.personCount} har gått gjennom`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {status === "lukket" && (
                    <button type="button" onClick={() => setEditing({ plan, reopen: true })} className={`${studioPrimaryButton} px-3 py-1.5 text-xs flex items-center gap-1.5`}>
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      Åpne på nytt
                    </button>
                  )}
                  <button type="button" onClick={() => setEditing({ plan })} className={`${studioSecondaryButton} flex items-center gap-1.5`}>
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    Endre
                  </button>
                  <button type="button" onClick={() => copyLink(plan)} className={`${studioSecondaryButton} flex items-center gap-1.5`}>
                    <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Kopier lenke
                  </button>
                  <button type="button" onClick={() => remove(plan)} className={`${studioSecondaryButton} flex items-center gap-1.5 hover:text-red-500`}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Slett
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
