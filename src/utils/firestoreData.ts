import { deleteField, type DocumentData, type UpdateData } from "firebase/firestore";

/**
 * The fields of a document, without its id. The id is the document's place, and is not stored
 * again inside it. Rules that list the allowed fields (`hasOnly`) would otherwise reject the write.
 */
export function documentFields<T extends { id: string }>(document: T): Omit<T, "id"> {
  const { id: _id, ...fields } = document;
  return fields;
}

/**
 * Sanitizes object to remove undefined values since Firestore rejects them.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Prepares a partial update of an existing document.
 * A field explicitly set to `undefined` is cleared. Dropping it, as sanitizeForFirestore
 * does, leaves the old value in place: an emptied phone number would come straight back.
 */
export function forUpdate(updates: object): UpdateData<DocumentData> {
  const prepared: UpdateData<DocumentData> = {};
  for (const [key, value] of Object.entries(updates)) {
    prepared[key] = value === undefined ? deleteField() : sanitizeForFirestore(value);
  }
  return prepared;
}
