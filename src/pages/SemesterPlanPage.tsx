import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useFirebase } from "../context/FirebaseDataContext";
import { useMySemesterPlans } from "../hooks/useSemesterPlans";
import { restartAnswer, saveAnswerStep } from "../services/semesterPlans";
import { formatNorwegianDateTime } from "../utils/dates";
import { locationOf } from "../utils/gatherings";
import { formatEventDay, myPlanTasks, nextCardIndex, type CardTask, type PlanCard } from "../utils/semesterPlan";

/** "10. januar": the day a task was taken for, in the line that says it is saved. */
const shortDay = (startsAt: string) => formatEventDay(startsAt).split(" ").slice(1).join(" ");

/**
 * The semester plan on Min side: the events in it one card at a time, with the tasks of all the
 * person's teams on each. On every card the person takes a task, says they cannot, or goes on.
 * Every choice is saved at once, so the way through can be left and taken up where it was left.
 */
export const SemesterPlanPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const { currentUser, assignTaskToPerson, updateAssignmentStatus, watchGatheringAssignments } = useFirebase();
  const { mine, ready } = useMySemesterPlans();
  const item = mine.find((candidate) => candidate.plan.id === planId);

  // Where the person is: settled once, when the plan and the answer have arrived
  const [index, setIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (index !== null || !ready || !item) return;
    setIndex(item.answer?.finishedAt ? item.cards.length : nextCardIndex(item.cards, item.answer));
  }, [index, ready, item]);

  const cards = item?.cards ?? [];
  const card: PlanCard | undefined = index !== null ? cards[index] : undefined;

  // Who else stands on the tasks, so the free places are right also where a member does not hold every assignment
  const cardGatheringId = card?.gathering.id;
  useEffect(() => (cardGatheringId ? watchGatheringAssignments(cardGatheringId) : undefined), [cardGatheringId, watchGatheringAssignments]);

  const shell = (children: React.ReactNode) => (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            to="/minside"
            aria-label="Tilbake til Min side"
            className="w-11 h-11 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">{item ? `Semesterplan ${item.plan.name}` : "Semesterplan"}</h1>
        </div>
        {children}
      </div>
    </div>
  );

  if (!ready || (item && index === null)) return shell(<p className="text-sm text-slate-500">Henter planen …</p>);

  if (!item || index === null) {
    return shell(
      <div className="p-6 text-center bg-white rounded-2xl border border-slate-200/80 text-sm text-slate-600 space-y-3">
        <p className="font-bold text-slate-800">Ingen semesterplan å gå gjennom her</p>
        <p>Planen er ikke åpen nå, eller den har ingen arrangementer for teamene du er med i.</p>
        <Link to="/minside" className="inline-block font-bold text-emerald-700 underline">
          Til Min side
        </Link>
      </div>
    );
  }

  const { plan, answer, stored } = item;
  const declined = new Set(answer?.declined ?? []);

  /** Past the card. `note` is what was just saved on it, shown on the next card. */
  const goOn = async (cannot: boolean, note: string | null = null) => {
    if (!card) return;
    setSaved(note);
    setProblem(null);
    const last = index + 1 >= cards.length;
    const ok = await saveAnswerStep(plan, currentUser.id, {
      passed: card.gathering.id,
      ...(cannot ? { declined: { gatheringId: card.gathering.id, cannot: true } } : {}),
      ...(last ? { finished: true } : {}),
    }, stored);
    if (ok) setIndex(index + 1);
  };

  const take = async (choice: CardTask) => {
    if (!card) return;
    setProblem(null);
    const result =
      choice.mine && !choice.holdsPlace
        ? updateAssignmentStatus(choice.mine.id, "confirmed")
        : assignTaskToPerson(choice.task.id, currentUser.id, "confirmed");
    if (!result.success) {
      setProblem(result.error || "Kunne ikke ta oppgaven.");
      return;
    }
    const note = `Lagt inn: ${choice.label} ${shortDay(card.gathering.startsAt)}`;
    setSaved(note);
    if (declined.has(card.gathering.id)) await saveAnswerStep(plan, currentUser.id, { declined: { gatheringId: card.gathering.id, cannot: false } }, stored);
    // With nothing more to take on the card, the next one comes by itself
    const more = card.tasks.some((other) => other.task.id !== choice.task.id && !other.holdsPlace && other.free > 0);
    if (!more) await goOn(false, note);
  };

  const startAgain = async () => {
    if (await restartAnswer(plan, currentUser.id)) {
      setSaved(null);
      setIndex(0);
    }
  };

  // ---------------------------------------------------------------- The end

  if (!card) {
    const taken = myPlanTasks(cards);
    return shell(
      <>
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-950">
          Takk! Du er ferdig med semesterplanen.
        </div>
        <section aria-labelledby="semester-my-tasks" className="space-y-2">
          <h2 id="semester-my-tasks" className="text-sm font-bold text-slate-800">
            Dine oppgaver
          </h2>
          {taken.length === 0 ? (
            <p className="text-xs text-slate-600 bg-white rounded-2xl border border-slate-200/80 p-3.5">Du har ikke tatt noen oppgaver i denne planen.</p>
          ) : (
            <ul className="space-y-2">
              {taken.map(({ card: takenCard, item: takenItem }) => (
                <li key={takenItem.task.id} className="p-3.5 bg-white rounded-2xl border border-slate-200/80">
                  <p className="text-sm font-bold text-slate-900">{takenItem.label}</p>
                  <p className="text-xs text-slate-600">
                    {formatEventDay(takenCard.gathering.startsAt)} · {takenCard.gathering.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Link to="/minside" className="block w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold text-center">
          Til Min side
        </Link>
        <button type="button" onClick={startAgain} className="block mx-auto text-xs font-semibold text-slate-600 underline cursor-pointer">
          Gå gjennom igjen
        </button>
      </>
    );
  }

  // ---------------------------------------------------------------- One card

  const progress = Math.round(((index + 1) / cards.length) * 100);
  return shell(
    <>
      {saved && (
        <div role="status" className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-semibold text-emerald-950">
          {saved}
        </div>
      )}
      {problem && (
        <div role="alert" className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-semibold text-amber-950">
          {problem}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-600">
          {index + 1} av {cards.length}
        </p>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={cards.length} aria-valuenow={index + 1}>
          <div className="h-full bg-orange-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <article className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3" aria-labelledby="semester-card-title">
        <div className="space-y-1">
          <h2 id="semester-card-title" className="text-base font-black text-slate-900">
            {card.gathering.title}
          </h2>
          <p className="text-xs text-slate-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            {formatNorwegianDateTime(card.gathering.startsAt)}
          </p>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            {locationOf(card.gathering)}
          </p>
        </div>

        <ul className="space-y-2">
          {card.tasks.map((choice) =>
            choice.holdsPlace ? (
              <li key={choice.task.id} className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-950">
                {choice.mine?.response === "pending" ? `Du er spurt om ${choice.label}. Svar på Min side.` : `Du står på ${choice.label}`}
              </li>
            ) : (
              <li key={choice.task.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{choice.label}</p>
                  <p className="text-xs text-slate-600">{choice.free > 0 ? `${choice.free} ledig` : "Fullt"}</p>
                </div>
                {choice.free > 0 && (
                  <button
                    type="button"
                    onClick={() => take(choice)}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer"
                  >
                    Ta oppgave
                  </button>
                )}
              </li>
            )
          )}
        </ul>

        {declined.has(card.gathering.id) && <p className="text-xs text-slate-500">Du har sagt at du ikke kan denne dagen.</p>}

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => goOn(true)}
            className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-sm font-semibold cursor-pointer"
          >
            Kan ikke
          </button>
          <button type="button" onClick={() => goOn(false)} className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold cursor-pointer">
            Neste
          </button>
        </div>
        {index > 0 && (
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              setIndex(index - 1);
            }}
            className="block mx-auto text-xs font-semibold text-slate-600 underline cursor-pointer"
          >
            Tilbake
          </button>
        )}
      </article>
    </>
  );
};
