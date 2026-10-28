import React from "react";
import { Link } from "react-router-dom";
import { Flag } from "lucide-react";
import type { MySemesterPlan } from "../../hooks/useSemesterPlans";
import { formatDayLong, semesterPlanPath } from "../../utils/semesterPlan";

/** A semester plan waiting for the user: the first thing on Mine oppgaver, until they have gone through it. */
export const SemesterPlanWaiting: React.FC<{ plans: MySemesterPlan[] }> = ({ plans }) => (
  <>
    {plans.map(({ plan, cards, answer }) => {
      const passed = new Set(answer?.passed ?? []);
      const left = cards.filter((card) => !passed.has(card.gathering.id)).length;
      const started = (answer?.passed.length ?? 0) > 0;
      return (
        <section
          key={plan.id}
          aria-labelledby={`semester-${plan.id}`}
          className="p-4 bg-gradient-to-br from-amber-50/90 to-amber-100/40 border border-amber-300/80 rounded-2xl shadow-xs space-y-3"
        >
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
              <Flag className="w-3 h-3" aria-hidden="true" />
              Semesterplan
            </span>
            <h2 id={`semester-${plan.id}`} className="text-sm font-bold text-slate-900">
              Semesterplanen for {plan.name} er klar
            </h2>
            <p className="text-xs text-slate-700">
              {left} {left === 1 ? "arrangement" : "arrangementer"} å gå gjennom · svar innen {formatDayLong(plan.answerBy)}
            </p>
          </div>
          <Link
            to={semesterPlanPath(plan.id)}
            className="block w-full py-3 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-bold text-center"
          >
            {started ? "Fortsett" : "Start"}
          </Link>
        </section>
      );
    })}
  </>
);

/** A semester plan the user has gone through: a way back to see or change the answers. */
export const SemesterPlanDone: React.FC<{ plans: MySemesterPlan[] }> = ({ plans }) => (
  <>
    {plans.map(({ plan }) => (
      <Link
        key={plan.id}
        to={semesterPlanPath(plan.id)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
      >
        <Flag className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
        Semesterplan {plan.name}: se eller endre svarene dine
      </Link>
    ))}
  </>
);
