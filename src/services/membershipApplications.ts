import { arrayUnion, doc, getDoc, writeBatch } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { buildMembershipApplication } from "../data/newDocuments";
import { db } from "../firebase";
import type { MembershipApplication, MembershipApplicationStatus, MembershipLogEntry, Person } from "../types";
import { documentFields, forUpdate, sanitizeForFirestore } from "../utils/firestoreData";
import { gToARegisterUpdate } from "../utils/denominationGToA";
import { membershipLogWithStatus, newMembershipLogEntry } from "../utils/membershipLog";
import { buildApplicationTask } from "../utils/membershipClerkTasks";
import { syncApplicationClerkTaskInstruction } from "./membershipClerkTasks";

/** Saves a membership form and appends a reference on the person's membership log. */
export async function submitMembershipApplication(
  data: Parameters<typeof buildMembershipApplication>[0]
): Promise<MembershipApplication> {
  const application = buildMembershipApplication(data);
  const batch = writeBatch(db);
  batch.set(
    doc(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS, application.id),
    sanitizeForFirestore(documentFields(application))
  );
  batch.update(doc(db, COLLECTIONS.PERSONS, application.personId), {
    membershipLog: arrayUnion(newMembershipLogEntry(application)),
  });
  const task = buildApplicationTask(application, application.submittedAt);
  batch.set(
    doc(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS, task.id),
    sanitizeForFirestore(documentFields(task))
  );
  await batch.commit();
  return application;
}

const stamp = () => new Date().toISOString();

async function syncPersonMembershipLog(
  personId: string,
  application: Pick<MembershipApplication, "id" | "kind" | "submittedAt">,
  status: MembershipApplicationStatus
): Promise<MembershipLogEntry[]> {
  const snap = await getDoc(doc(db, COLLECTIONS.PERSONS, personId));
  const person = snap.data() as Person | undefined;
  return membershipLogWithStatus(person?.membershipLog, application, status, stamp());
}

async function clerkStep(
  application: Pick<MembershipApplication, "id" | "personId" | "kind" | "submittedAt">,
  _clerkId: string,
  status: MembershipApplicationStatus,
  fields: Record<string, string>
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS, application.id), forUpdate({ status, ...fields }));
  const log = await syncPersonMembershipLog(application.personId, application, status);
  batch.update(doc(db, COLLECTIONS.PERSONS, application.personId), forUpdate({ membershipLog: log }));
  await batch.commit();
  await syncApplicationClerkTaskInstruction({ id: application.id, kind: application.kind, status });
}

export function receiveMembershipApplication(
  application: Pick<MembershipApplication, "id" | "personId" | "kind" | "submittedAt">,
  clerkId: string
): Promise<void> {
  return clerkStep(application, clerkId, "received", { receivedAt: stamp(), receivedBy: clerkId });
}

export function markMembershipApplicationCornerstone(
  application: Pick<MembershipApplication, "id" | "personId" | "kind" | "submittedAt">,
  clerkId: string
): Promise<void> {
  return clerkStep(application, clerkId, "cornerstoneDone", { cornerstoneAt: stamp(), cornerstoneBy: clerkId });
}

/** Setter søknaden tilbake til «sendt» når protokoll fjerner Cornerstone-steget. */
export async function revertMembershipApplicationClerkStep(
  application: Pick<MembershipApplication, "id" | "personId" | "kind" | "submittedAt" | "status">
): Promise<void> {
  if (application.status === "submitted") return;
  const batch = writeBatch(db);
  batch.update(
    doc(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS, application.id),
    forUpdate({
      status: "submitted",
      receivedAt: undefined,
      receivedBy: undefined,
      cornerstoneAt: undefined,
      cornerstoneBy: undefined,
      completedAt: undefined,
      completedBy: undefined,
      dismissedAt: undefined,
      dismissedBy: undefined,
    })
  );
  const log = await syncPersonMembershipLog(application.personId, application, "submitted");
  batch.update(doc(db, COLLECTIONS.PERSONS, application.personId), forUpdate({ membershipLog: log }));
  await batch.commit();
  await syncApplicationClerkTaskInstruction({ id: application.id, kind: application.kind, status: "submitted" });
}

export async function completeMembershipApplication(
  application: Pick<MembershipApplication, "id" | "kind" | "personId" | "submittedAt">,
  clerkId: string,
  reference?: { transitionGEndedAt?: string; transitionAStartedAt?: string }
): Promise<void> {
  const completedAt = stamp();
  const applicationFields = {
    status: "completed" as const,
    completedAt,
    completedBy: clerkId,
    ...(reference?.transitionGEndedAt ? { transitionGEndedAt: reference.transitionGEndedAt } : {}),
    ...(reference?.transitionAStartedAt ? { transitionAStartedAt: reference.transitionAStartedAt } : {}),
  };
  const log = await syncPersonMembershipLog(application.personId, application, "completed");

  if (
    application.kind === "denominationGToA" &&
    reference?.transitionGEndedAt &&
    reference?.transitionAStartedAt
  ) {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS, application.id), forUpdate(applicationFields));
    batch.update(
      doc(db, COLLECTIONS.PERSONS, application.personId),
      forUpdate({ ...gToARegisterUpdate(reference.transitionGEndedAt, reference.transitionAStartedAt), membershipLog: log })
    );
    await batch.commit();
    await syncApplicationClerkTaskInstruction({ id: application.id, kind: application.kind, status: "completed" });
    return;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS, application.id), forUpdate(applicationFields));
  batch.update(doc(db, COLLECTIONS.PERSONS, application.personId), forUpdate({ membershipLog: log }));
  await batch.commit();
  await syncApplicationClerkTaskInstruction({ id: application.id, kind: application.kind, status: "completed" });
}

export function dismissMembershipApplication(
  application: Pick<MembershipApplication, "id" | "personId" | "kind" | "submittedAt">,
  clerkId: string
): Promise<void> {
  return clerkStep(application, clerkId, "dismissed", { dismissedAt: stamp(), dismissedBy: clerkId });
}

/** Address of the archival page for one application in admin. */
export function membershipApplicationAdminPath(applicationId: string): string {
  return `/admin/medlemskap/${applicationId}`;
}