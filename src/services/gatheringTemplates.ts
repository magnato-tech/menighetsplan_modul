import { collection, onSnapshot, query, where } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { GATHERING_TEMPLATE_RECORD, gatheringTemplateFields } from "../data/settingsRecords";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { byTemplateName, type GatheringTemplate } from "../utils/gatheringTemplates";
import { createDocument, deleteDocument } from "./firestore";
import { reportWriteError } from "./writeErrors";

// The templates for events are stored as documents in cms_settings, each marked as a template,
// like the volunteer roles (see services/volunteerRoles.ts): the rules in a database in use are
// older than the file, and turn a new collection away until they are published.

export function subscribeGatheringTemplates(onChange: (templates: GatheringTemplate[]) => void): () => void {
  return onSnapshot(
    // Only the templates are asked for: the collection also holds the visit counts, which change with every visit
    query(collection(db, CMS_COLLECTIONS.SETTINGS), where("recordType", "==", GATHERING_TEMPLATE_RECORD)),
    (snapshot) => {
      const templates = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }) as GatheringTemplate & { recordType?: string })
        .filter((template) => template.recordType === GATHERING_TEMPLATE_RECORD && typeof template.name === "string")
        .map(({ recordType: _mark, ...template }) => ({ ...template, program: template.program ?? [], extraStaffing: template.extraStaffing ?? [] }) as GatheringTemplate);
      onChange(templates.sort(byTemplateName));
    },
    (error) => handleFirestoreError(error, OperationType.GET, CMS_COLLECTIONS.SETTINGS)
  );
}

/** Stores a template, new or changed. Says whether it went well; a failure is reported to the one at the screen. */
export async function saveGatheringTemplate(template: GatheringTemplate): Promise<boolean> {
  try {
    await createDocument(CMS_COLLECTIONS.SETTINGS, gatheringTemplateFields({ ...template, updatedAt: new Date().toISOString() }));
    return true;
  } catch (error) {
    reportWriteError("lagre malen", error);
    return false;
  }
}

export async function deleteGatheringTemplate(templateId: string): Promise<boolean> {
  try {
    await deleteDocument(CMS_COLLECTIONS.SETTINGS, templateId);
    return true;
  } catch (error) {
    reportWriteError("slette malen", error);
    return false;
  }
}
