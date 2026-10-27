import React, { useMemo, useState } from "react";
import type { Gathering, Group, Task } from "../../types";
import { combineDateAndTimeToIso, parseIsoToDateAndTime } from "../../utils/dates";
import { planFormProblems, planSummary, type SemesterPlan, type SemesterPlanForm } from "../../utils/semesterPlan";
import { newId } from "../../utils/id";
import { studioCardPadded, studioInputFull, studioPrimaryButton, studioSecondaryButton } from "./studioTheme";

interface SemesterPlanFormCardProps {
  /** The plan being changed, or absent for a new one. */
  plan?: SemesterPlan;
  /** Open a closed plan again: a new opening and a new answer day, and so a new round for everyone. */
  reopen?: boolean;
  /** The other plans, whose days this one may not meet. */
  others: readonly SemesterPlan[];
  gatherings: readonly Gathering[];
  tasks: readonly Task[];
  groups: readonly Group[];
  onSave: (plan: SemesterPlan) => Promise<boolean>;
  onCancel: () => void;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** A new plan opens now, at the next whole hour: what is most often meant. */
function newForm(now = new Date()): SemesterPlanForm {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const { date, time } = parseIsoToDateAndTime(next.toISOString());
  return { name: "", firstDay: "", lastDay: "", answerBy: "", opensDate: date, opensTime: time || `${twoDigits(next.getHours())}:00` };
}

function formOf(plan: SemesterPlan, reopen: boolean): SemesterPlanForm {
  if (reopen) {
    const fresh = newForm();
    return { ...fresh, name: plan.name, firstDay: plan.firstDay, lastDay: plan.lastDay };
  }
  const { date, time } = parseIsoToDateAndTime(plan.opensAt);
  return { name: plan.name, firstDay: plan.firstDay, lastDay: plan.lastDay, answerBy: plan.answerBy, opensDate: date, opensTime: time };
}

const labelClass = "block text-xs font-bold text-[var(--studio-text)] mb-1.5";

/**
 * The form a semester plan is made and changed in. While it is filled in, it says how many events
 * the plan holds and how many get the flag, so a period without tasks is seen before it is released.
 */
export const SemesterPlanFormCard: React.FC<SemesterPlanFormCardProps> = ({ plan, reopen = false, others, gatherings, tasks, groups, onSave, onCancel }) => {
  const [form, setForm] = useState<SemesterPlanForm>(() => (plan ? formOf(plan, reopen) : newForm()));
  const [saving, setSaving] = useState(false);
  const set = (field: keyof SemesterPlanForm) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: event.target.value });

  const summary = useMemo(() => planSummary(form, gatherings, tasks, groups), [form, gatherings, tasks, groups]);
  const problems = planFormProblems(form, others);
  const periodChosen = Boolean(form.firstDay && form.lastDay && form.firstDay <= form.lastDay);
  const canSave = problems.length === 0 && summary.gatheringCount > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const now = new Date().toISOString();
    const saved = await onSave({
      id: plan?.id ?? newId("semesterplan"),
      name: form.name.trim(),
      firstDay: form.firstDay,
      lastDay: form.lastDay,
      answerBy: form.answerBy,
      opensAt: combineDateAndTimeToIso(form.opensDate, form.opensTime),
      createdAt: plan?.createdAt ?? now,
    });
    setSaving(false);
    if (saved) onCancel();
  };

  return (
    <section className={`${studioCardPadded} space-y-4`} aria-labelledby="semester-plan-form-title">
      <h3 id="semester-plan-form-title" className="text-base font-black text-[var(--studio-text)]">
        {plan ? (reopen ? `Åpne ${plan.name} på nytt` : `Endre ${plan.name}`) : "Ny semesterplan"}
      </h3>

      <div>
        <label htmlFor="semester-name" className={labelClass}>
          Navn
        </label>
        <input id="semester-name" value={form.name} onChange={set("name")} placeholder="Våren 2027" className={studioInputFull} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="semester-first-day" className={labelClass}>
            Første dag
          </label>
          <input id="semester-first-day" type="date" value={form.firstDay} onChange={set("firstDay")} className={studioInputFull} />
        </div>
        <div>
          <label htmlFor="semester-last-day" className={labelClass}>
            Siste dag
          </label>
          <input id="semester-last-day" type="date" value={form.lastDay} onChange={set("lastDay")} className={studioInputFull} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="semester-answer-by" className={labelClass}>
            Svarfrist
          </label>
          <input id="semester-answer-by" type="date" value={form.answerBy} onChange={set("answerBy")} className={studioInputFull} />
        </div>
        <div>
          <label htmlFor="semester-opens-date" className={labelClass}>
            Åpner, dato
          </label>
          <input id="semester-opens-date" type="date" value={form.opensDate} onChange={set("opensDate")} className={studioInputFull} />
        </div>
        <div>
          <label htmlFor="semester-opens-time" className={labelClass}>
            Åpner, klokkeslett
          </label>
          <input id="semester-opens-time" type="time" value={form.opensTime} onChange={set("opensTime")} className={studioInputFull} />
        </div>
      </div>

      <p className="text-xs font-bold text-[var(--studio-text)]" aria-live="polite">
        {summary.gatheringCount} {summary.gatheringCount === 1 ? "arrangement" : "arrangementer"} med oppgaver for team · {summary.personCount}{" "}
        {summary.personCount === 1 ? "person får" : "personer får"} flagget
      </p>
      {periodChosen && summary.gatheringCount === 0 && (
        <p className="text-xs font-semibold text-amber-500">Det er ingen arrangementer med oppgaver for team i perioden. Sjekk første og siste dag.</p>
      )}
      {reopen && (
        <p className="text-xs text-[var(--studio-text)]">
          Velg ny åpning og ny svarfrist. Da får alle i teamene flagget igjen og går gjennom fra start. Det de har sagt at de ikke kan, huskes.
        </p>
      )}
      {problems.length > 0 && form.name !== "" && (
        <ul className="text-xs text-[var(--studio-muted)] list-disc pl-4">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-[var(--studio-muted)]">
        Ingen ser planen før den åpner, og den lukkes når svarfristen er ute. Mens den er åpen, har alle i teamene et flagg på Min side og går
        gjennom arrangementene ett om gangen.
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={studioSecondaryButton}>
          Avbryt
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={`${studioPrimaryButton} px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {plan ? (reopen ? "Åpne på nytt" : "Lagre endringene") : "Frigi semesterplanen"}
        </button>
      </div>
    </section>
  );
};
