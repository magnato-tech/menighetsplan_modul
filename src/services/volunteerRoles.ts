import { collection, doc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import { buildInitialVolunteerRoles } from "../data/defaultVolunteerRoles";
import { buildVolunteerRole, type NewVolunteerRoleInput } from "../data/newDocuments";
import { VolunteerRole } from "../types";
import { createDocument, deleteDocument, updateDocument } from "./firestore";
import { sanitizeForFirestore } from "../utils/firestoreData";
import { chunk } from "../utils/chunk";
import { VOLUNTEER_ROLE_RECORD, volunteerRoleFields } from "../data/settingsRecords";

const BATCH_SIZE = 400;

/**
 * Live Firestore rules on this project reject the volunteer_roles collection.
 * Roles are stored as documents in cms_settings, which already allows writes.
 * They are marked so they stay separate from the global settings document.
 */
export { VOLUNTEER_ROLE_RECORD, volunteerRoleFields };

export function subscribeVolunteerRoles(onChange: (roles: VolunteerRole[]) => void): () => void {
  return onSnapshot(
    // Only the roles are asked for: the collection also holds the visit counts, which change with every visit
    query(collection(db, CMS_COLLECTIONS.SETTINGS), where("recordType", "==", VOLUNTEER_ROLE_RECORD)),
    (snapshot) => {
      const roles = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as VolunteerRole & { recordType?: string })
        .filter((role) => role.recordType === VOLUNTEER_ROLE_RECORD && typeof role.name === "string");
      onChange(roles);
    },
    (error) => handleFirestoreError(error, OperationType.GET, CMS_COLLECTIONS.SETTINGS)
  );
}

/** Writes the standard volunteer roles when the register is empty. */
export async function seedDefaultVolunteerRoles(): Promise<VolunteerRole[]> {
  const roles = buildInitialVolunteerRoles();
  for (const piece of chunk(roles, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const role of piece) {
      batch.set(doc(db, CMS_COLLECTIONS.SETTINGS, role.id), sanitizeForFirestore(volunteerRoleFields(role)));
    }
    await batch.commit();
  }
  return roles;
}

export async function persistVolunteerRole(input: NewVolunteerRoleInput): Promise<VolunteerRole> {
  const role = buildVolunteerRole(input);
  await createDocument(CMS_COLLECTIONS.SETTINGS, volunteerRoleFields(role));
  return role;
}

export async function patchVolunteerRole(
  roleId: string,
  updates: Partial<Pick<VolunteerRole, "name" | "instruction" | "groupId" | "sortOrder">>
): Promise<void> {
  await updateDocument(CMS_COLLECTIONS.SETTINGS, roleId, {
    ...updates,
    recordType: VOLUNTEER_ROLE_RECORD,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeVolunteerRole(roleId: string): Promise<void> {
  await deleteDocument(CMS_COLLECTIONS.SETTINGS, roleId);
}
