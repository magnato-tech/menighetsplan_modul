import { arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, writeBatch } from "firebase/firestore";
import { newClerkMembershipLogEntry } from "../utils/membershipLog";
import { COLLECTIONS } from "../data/collections";
import { db } from "../firebase";
import type { MembershipApplication, MembershipClerkTask, Person } from "../types";
import { documentFields, forUpdate, sanitizeForFirestore } from "../utils/firestoreData";
import {
  applicationSettled,
  applicationTaskId,
  applicationTaskInstruction,
  buildApplicationTask,
  buildDateCorrectionTask,
  buildWithdrawalTask,
  canCompleteDateCorrectionTask,
  canCompleteWithdrawalTask,
  dateCorrectionTaskId,
  enrollmentDateCorrectionNeeded,
} from "../utils/membershipClerkTasks";
const stamp = () => new Date().toISOString();

export async function createApplicationClerkTask(application: MembershipApplication): Promise<void> {
  const task = buildApplicationTask(application, stamp());
  await setDoc(
    doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
    sanitizeForFirestore(documentFields(task))
  );
}

export async function syncApplicationClerkTaskInstruction(
  application: Pick<MembershipApplication, "id" | "kind" | "status">
): Promise<void> {
  const taskId = applicationTaskId(application.id);
  const ref = doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, taskId);
  if (applicationSettled(application.status)) {
    const batch = writeBatch(db);
    batch.set(
      ref,
      forUpdate({
        status: "done",
        doneAt: stamp(),
        instruction: applicationTaskInstruction(application),
      }),
      { merge: true }
    );
    await batch.commit();
    return;
  }
  await setDoc(
    ref,
    forUpdate({ instruction: applicationTaskInstruction(application), status: "open" }),
    { merge: true }
  );
}

export async function ensureEnrollmentDateCorrectionTasks(
  persons: readonly Person[]
): Promise<void> {
  const existing = await getDocs(query(collection(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS)));
  const byId = new Map(existing.docs.map((snap) => [snap.id, snap.data() as MembershipClerkTask]));
  const batch = writeBatch(db);
  let writes = 0;
  const now = stamp();

  for (const person of persons) {
    for (const field of enrollmentDateCorrectionNeeded(person)) {
      const id = dateCorrectionTaskId(person.id, field);
      const hit = byId.get(id);
      if (hit?.status === "done") continue;
      if (hit?.status === "open") continue;
      const task = buildDateCorrectionTask(person, field, now);
      batch.set(doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id), sanitizeForFirestore(documentFields(task)));
      writes++;
    }
  }
  if (writes > 0) await batch.commit();
}

export async function updateClerkTask(
  taskId: string,
  patch: Partial<MembershipClerkTask>
): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, taskId), forUpdate(patch), { merge: true });
}

export async function recordWithdrawalAttestationDelivery(
  task: MembershipClerkTask,
  clerkId: string,
  info:
    | { channel: "email"; to: string; copyTo: string }
    | { channel: "post" }
): Promise<void> {
  const at = stamp();
  const batch = writeBatch(db);

  if (info.channel === "email") {
    const note = `Utmeldingsattest sendt på e-post til ${info.to} (kopi til ${info.copyTo}).`;
    batch.update(doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id), {
      ...forUpdate({
        attestationEmailedAt: at,
        attestationEmailedBy: clerkId,
      }),
    });
    batch.update(doc(db, COLLECTIONS.PERSONS, task.personId), {
      membershipLog: arrayUnion(
        newClerkMembershipLogEntry({
          taskId: task.id,
          kind: "withdrawal",
          submittedAt: at,
          status: "completed",
          note,
          updatedAt: at,
        })
      ),
    });
  } else {
    batch.update(doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id), {
      ...forUpdate({ attestationPosted: true }),
    });
    batch.update(doc(db, COLLECTIONS.PERSONS, task.personId), {
      membershipLog: arrayUnion(
        newClerkMembershipLogEntry({
          taskId: task.id,
          kind: "withdrawal",
          submittedAt: at,
          status: "completed",
          note: "Utmeldingsattest sendt med brevpost.",
          updatedAt: at,
        })
      ),
    });
  }
  await batch.commit();
}

export async function completeDateCorrectionTask(
  task: MembershipClerkTask,
  correctedDate: string,
  clerkId: string
): Promise<void> {
  const check = canCompleteDateCorrectionTask(correctedDate, task.cornerstoneUpdated);
  if (!check.ok) throw new Error(check.reason);
  if (!task.enrollmentField) throw new Error("Mangler felt å rette.");

  const doneAt = stamp();
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.PERSONS, task.personId), {
    [task.enrollmentField]: correctedDate,
    membershipLog: arrayUnion(
      newClerkMembershipLogEntry({
        taskId: task.id,
        kind: "enrollmentDateCorrection",
        submittedAt: task.createdAt,
        status: "completed",
        note: `Ny dato ${correctedDate}`,
        updatedAt: doneAt,
      })
    ),
  });
  batch.update(
    doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
    forUpdate({
      status: "done",
      correctedEnrollmentDate: correctedDate,
      doneAt,
      doneBy: clerkId,
    })
  );
  await batch.commit();
}

export async function completeWithdrawalTask(task: MembershipClerkTask, clerkId: string): Promise<void> {
  const check = canCompleteWithdrawalTask(task);
  if (!check.ok) throw new Error(check.reason);
  if (!task.withdrawalDate) throw new Error("Mangler utmeldingsdato.");

  const personUpdate: Partial<Person> = {};
  if (task.withdrawCongregation) {
    personUpdate.congregationMember = false;
    personUpdate.congregationEndedAt = task.withdrawalDate;
  }
  if (task.withdrawDenomination) {
    personUpdate.denominationMember = false;
    personUpdate.denominationEndedAt = task.withdrawalDate;
  }
  const doneAt = stamp();
  const scope = [
    task.withdrawCongregation ? "menighet" : null,
    task.withdrawDenomination ? "trossamfunn" : null,
  ]
    .filter(Boolean)
    .join(" og ");

  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.PERSONS, task.personId), {
    ...forUpdate(personUpdate),
    membershipLog: arrayUnion(
      newClerkMembershipLogEntry({
        taskId: task.id,
        kind: "withdrawal",
        submittedAt: task.createdAt,
        status: "completed",
        note: task.withdrawalDate ? `Utmeldt ${scope} ${task.withdrawalDate}` : scope,
        updatedAt: doneAt,
      })
    ),
  });
  batch.update(
    doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
    forUpdate({ status: "done", doneAt, doneBy: clerkId, comment: task.comment })
  );
  await batch.commit();
}

export async function createWithdrawalClerkTask(
  person: Pick<Person, "id" | "name">,
  opts: {
    withdrawCongregation: boolean;
    withdrawDenomination: boolean;
    withdrawalDate: string;
    comment?: string;
  }
): Promise<MembershipClerkTask> {
  if (!opts.withdrawCongregation && !opts.withdrawDenomination) {
    throw new Error("Velg menighet og/eller trossamfunn.");
  }
  const task = buildWithdrawalTask(person, { ...opts, createdAt: stamp() });
  await setDoc(
    doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
    sanitizeForFirestore(documentFields(task))
  );
  return task;
}

/** Skriver inn manglende demopersoner for protokolloppgavene (kun demoen). */
async function ensureDemoMembershipClerkPersons(persons: readonly Person[]): Promise<Person[]> {
  const { getMockDocuments } = await import("../data/mockDocuments");
  const { DEMO_MEMBERSHIP_CLERK_PERSON_IDS } = await import("../utils/demoMembershipClerkSeed");
  const present = new Set(persons.map((p) => p.id));
  const batch = writeBatch(db);
  const added: Person[] = [];
  for (const docItem of getMockDocuments()) {
    if (docItem.collection !== COLLECTIONS.PERSONS) continue;
    const person = docItem.data as Person;
    if (!DEMO_MEMBERSHIP_CLERK_PERSON_IDS.has(person.id) || present.has(person.id)) continue;
    batch.set(
      doc(db, COLLECTIONS.PERSONS, person.id),
      sanitizeForFirestore(documentFields(person))
    );
    added.push(person);
  }
  if (added.length > 0) await batch.commit();
  return added.length > 0 ? [...persons, ...added] : [...persons];
}

/** Demoen: 20 åpne protokolloppgaver (12 dato, 6 søknad, 2 utmelding) med fast id og repopulering. */
export async function ensureDemoMembershipClerkBoard(
  persons: readonly Person[],
  churchName: string,
  tasks: readonly MembershipClerkTask[]
): Promise<void> {
  const {
    DEMO_APPLICATION_SPECS,
    buildDemoMembershipApplication,
    demoApplicationClerkTask,
    demoClerkBoardNeedsReseed,
    demoDateCorrectionTasksForSeed,
    demoLegacyDateResetForField,
    demoWithdrawalTasksForSeed,
    demoWithdrawalTaskId,
  } = await import("../utils/demoMembershipClerkSeed");
  const { DEMO_LEGACY_PROTOCOL_PERSON_IDS, DEMO_WITHDRAWAL_TASK_PERSON_IDS } = await import("../utils/mockMembershipSeed");
  const { membershipLogWithStatus } = await import("../utils/membershipLog");

  const roster = await ensureDemoMembershipClerkPersons(persons);
  if (!demoClerkBoardNeedsReseed(tasks, roster)) return;

  const batch = writeBatch(db);
  const now = stamp();
  let writes = 0;

  for (const task of tasks) {
    if (task.kind !== "withdrawal" || task.status !== "open") continue;
    if (!DEMO_WITHDRAWAL_TASK_PERSON_IDS.has(task.personId)) continue;
    const canonical = demoWithdrawalTaskId(task.personId);
    if (task.id !== canonical) {
      batch.update(doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id), forUpdate({ status: "done", doneAt: now }));
      writes++;
    }
  }

  for (const person of roster) {
    if (!DEMO_LEGACY_PROTOCOL_PERSON_IDS.has(person.id)) continue;
    for (const { task, field } of demoDateCorrectionTasksForSeed(person, now)) {
      batch.set(
        doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
        sanitizeForFirestore(documentFields(task))
      );
      batch.update(doc(db, COLLECTIONS.PERSONS, person.id), forUpdate(demoLegacyDateResetForField(field)));
      writes++;
    }
  }

  for (const spec of DEMO_APPLICATION_SPECS) {
    const person = roster.find((p) => p.id === spec.personId);
    if (!person) continue;
    const application = buildDemoMembershipApplication(person, churchName, spec);
    const task = demoApplicationClerkTask(application);
    batch.set(
      doc(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS, application.id),
      sanitizeForFirestore(documentFields(application))
    );
    batch.set(
      doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
      sanitizeForFirestore(documentFields(task))
    );
    const stored = (await getDoc(doc(db, COLLECTIONS.PERSONS, person.id))).data() as Person | undefined;
    const log = membershipLogWithStatus(stored?.membershipLog, application, "submitted", application.submittedAt);
    batch.update(doc(db, COLLECTIONS.PERSONS, person.id), forUpdate({ membershipLog: log }));
    writes++;
  }

  for (const task of demoWithdrawalTasksForSeed(roster, now)) {
    batch.set(
      doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
      sanitizeForFirestore(documentFields(task))
    );
    writes++;
  }

  if (writes > 0) await batch.commit();
}