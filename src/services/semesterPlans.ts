import { arrayRemove, arrayUnion, collection, deleteField, doc, getDocs, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { SEMESTER_ANSWER_RECORD, SEMESTER_PLAN_RECORD } from "../data/settingsRecords";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { semesterAnswerId, type SemesterAnswer, type SemesterPlan } from "../utils/semesterPlan";
import { sanitizeForFirestore } from "../utils/firestoreData";
import { reportWriteError } from "./writeErrors";

// The semester plans and the answers to them are stored in cms_settings, each marked, like the
// templates and the roles (see services/gatheringTemplates.ts): the rules in a database in use are
// older than the file, and turn a new collection away until they are published.
//
// A plan is written by an administrator. An answer is written by the person it belongs to, and
// only changed with arrayUnion and arrayRemove, so two screens open at once cannot overwrite
// each other.

const settings = () => collection(db, CMS_COLLECTIONS.SETTINGS);

export function subscribeSemesterPlans(onChange: (plans: SemesterPlan[]) => void): () => void {
  return onSnapshot(
    // Only the plans are asked for: the collection also holds the visit counts, which change with every visit
    query(settings(), where("recordType", "==", SEMESTER_PLAN_RECORD)),
    (snapshot) => {
      const plans = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }) as SemesterPlan & { recordType?: string })
        .filter((plan) => plan.recordType === SEMESTER_PLAN_RECORD && typeof plan.name === "string")
        .map(({ recordType: _mark, ...plan }) => plan as SemesterPlan);
      onChange(plans.sort((a, b) => b.firstDay.localeCompare(a.firstDay)));
    },
    (error) => handleFirestoreError(error, OperationType.GET, CMS_COLLECTIONS.SETTINGS)
  );
}

const toAnswer = (data: Record<string, unknown>, id: string): SemesterAnswer => ({
  id,
  planId: String(data.planId ?? ""),
  personId: String(data.personId ?? ""),
  passed: Array.isArray(data.passed) ? (data.passed as string[]) : [],
  declined: Array.isArray(data.declined) ? (data.declined as string[]) : [],
  ...(typeof data.finishedAt === "string" ? { finishedAt: data.finishedAt } : {}),
  ...(typeof data.round === "string" ? { round: data.round } : {}),
  ...(typeof data.updatedAt === "string" ? { updatedAt: data.updatedAt } : {}),
});

/** The answers of one person, to every plan. */
export function subscribeMySemesterAnswers(personId: string, onChange: (answers: SemesterAnswer[]) => void): () => void {
  return onSnapshot(
    query(settings(), where("recordType", "==", SEMESTER_ANSWER_RECORD), where("personId", "==", personId)),
    (snapshot) => onChange(snapshot.docs.map((d) => toAnswer(d.data(), d.id))),
    (error) => handleFirestoreError(error, OperationType.GET, CMS_COLLECTIONS.SETTINGS)
  );
}

/** Every answer, for the administrator's overview. */
export function subscribeAllSemesterAnswers(onChange: (answers: SemesterAnswer[]) => void): () => void {
  return onSnapshot(
    query(settings(), where("recordType", "==", SEMESTER_ANSWER_RECORD)),
    (snapshot) => onChange(snapshot.docs.map((d) => toAnswer(d.data(), d.id))),
    (error) => handleFirestoreError(error, OperationType.GET, CMS_COLLECTIONS.SETTINGS)
  );
}

/** Stores a plan, new or changed. Says whether it went well; a failure is reported to the one at the screen. */
export async function saveSemesterPlan(plan: SemesterPlan): Promise<boolean> {
  try {
    await setDoc(
      doc(settings(), plan.id),
      sanitizeForFirestore({ ...plan, recordType: SEMESTER_PLAN_RECORD, updatedAt: new Date().toISOString() })
    );
    return true;
  } catch (error) {
    reportWriteError("lagre semesterplanen", error);
    return false;
  }
}

/** Removes a plan and the answers to it, in one sending. */
export async function deleteSemesterPlan(planId: string): Promise<boolean> {
  try {
    const answers = await getDocs(query(settings(), where("recordType", "==", SEMESTER_ANSWER_RECORD), where("planId", "==", planId)));
    const batch = writeBatch(db);
    for (const answer of answers.docs) batch.delete(answer.ref);
    batch.delete(doc(settings(), planId));
    await batch.commit();
    return true;
  } catch (error) {
    reportWriteError("slette semesterplanen", error);
    return false;
  }
}

/** What a step through the plan changes in the person's answer. */
export interface AnswerStep {
  /** The event gone past. */
  passed?: string;
  /** The event the person cannot, or no longer cannot (`false`). */
  declined?: { gatheringId: string; cannot: boolean };
  /** The end reached. */
  finished?: boolean;
}

/**
 * Writes one step of a person's way through a plan, without reading first. `stored` is the answer as
 * the listener has it: when it belongs to an earlier round, the way through is started afresh.
 */
export async function saveAnswerStep(
  plan: Pick<SemesterPlan, "id" | "opensAt">,
  personId: string,
  step: AnswerStep,
  stored: Pick<SemesterAnswer, "round"> | null
): Promise<boolean> {
  const now = new Date().toISOString();
  const newRound = stored?.round !== plan.opensAt;
  const fields: Record<string, unknown> = { recordType: SEMESTER_ANSWER_RECORD, planId: plan.id, personId, round: plan.opensAt, updatedAt: now };
  if (step.passed) fields.passed = newRound ? [step.passed] : arrayUnion(step.passed);
  else if (newRound) fields.passed = [];
  if (step.declined) fields.declined = step.declined.cannot ? arrayUnion(step.declined.gatheringId) : arrayRemove(step.declined.gatheringId);
  if (step.finished) fields.finishedAt = now;
  else if (newRound) fields.finishedAt = deleteField();
  try {
    await setDoc(doc(settings(), semesterAnswerId(plan.id, personId)), fields, { merge: true });
    return true;
  } catch (error) {
    reportWriteError("lagre svaret", error);
    return false;
  }
}

/** «Gå gjennom igjen»: back to the first card. What the person cannot is kept until they say otherwise. */
export async function restartAnswer(plan: Pick<SemesterPlan, "id" | "opensAt">, personId: string): Promise<boolean> {
  try {
    await setDoc(
      doc(settings(), semesterAnswerId(plan.id, personId)),
      {
        recordType: SEMESTER_ANSWER_RECORD,
        planId: plan.id,
        personId,
        round: plan.opensAt,
        passed: [],
        finishedAt: deleteField(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    reportWriteError("starte semesterplanen på nytt", error);
    return false;
  }
}
