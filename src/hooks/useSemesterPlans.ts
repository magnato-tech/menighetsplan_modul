import { useEffect, useMemo, useState } from "react";
import { useFirebase } from "../context/FirebaseDataContext";
import { subscribeMySemesterAnswers, subscribeSemesterPlans } from "../services/semesterPlans";
import { answerInRound, cardsFor, planStatus, waitsForAnswer, type PlanCard, type SemesterAnswer, type SemesterPlan } from "../utils/semesterPlan";

/** The semester plans, the newest first, and whether they have arrived. */
export function useSemesterPlans(): { plans: SemesterPlan[]; ready: boolean } {
  const [plans, setPlans] = useState<SemesterPlan[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(
    () =>
      subscribeSemesterPlans((list) => {
        setPlans(list);
        setReady(true);
      }),
    []
  );
  return { plans, ready };
}

export interface MySemesterPlan {
  plan: SemesterPlan;
  cards: PlanCard[];
  /** The answer as it counts in the plan's present round (see answerInRound). */
  answer: SemesterAnswer | null;
  /** The answer as it is stored, which a step is written on top of. */
  stored: SemesterAnswer | null;
  /** Open, with cards for the person, and not gone through to the end: what the flag is for. */
  waiting: boolean;
}

/**
 * The plans that are open for the person signed in, with the cards they go through and how far
 * they have come. A plan that has not opened yet, or has nothing for them, is left out.
 */
export function useMySemesterPlans(): { mine: MySemesterPlan[]; ready: boolean } {
  const { currentUser, gatherings, tasks, groups, assignments, volunteerRoles } = useFirebase();
  const { plans, ready: plansReady } = useSemesterPlans();
  const [answers, setAnswers] = useState<SemesterAnswer[]>([]);
  const [answersReady, setAnswersReady] = useState(false);

  useEffect(() => {
    if (!currentUser.id) return;
    return subscribeMySemesterAnswers(currentUser.id, (list) => {
      setAnswers(list);
      setAnswersReady(true);
    });
  }, [currentUser.id]);

  const mine = useMemo(() => {
    const now = new Date();
    return plans
      .filter((plan) => planStatus(plan, now) === "apen")
      .map((plan) => {
        const cards = cardsFor(plan, currentUser.id, { gatherings, tasks, groups, assignments, roles: volunteerRoles });
        const stored = answers.find((candidate) => candidate.planId === plan.id) ?? null;
        return { plan, cards, answer: answerInRound(plan, stored), stored, waiting: waitsForAnswer(plan, cards, stored, now) };
      })
      .filter((item) => item.cards.length > 0)
      .sort((a, b) => a.plan.firstDay.localeCompare(b.plan.firstDay));
  }, [plans, answers, currentUser.id, gatherings, tasks, groups, assignments, volunteerRoles]);

  return { mine, ready: plansReady && answersReady };
}
