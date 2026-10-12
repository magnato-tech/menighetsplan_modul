// Documents that follow from the register and are kept beside it: the logins (utils/logins.ts)
// and the public copies of persons (utils/publicProfile.ts). The register is what is edited.
// These are written again from it, and this file says what has to be written for them to agree.

export interface MirrorChanges<T> {
  /** Documents to write: new ones, and ones that say something else than what is stored. */
  set: T[];
  /** The ids of documents that are stored, and that the register no longer gives. */
  remove: string[];
}

// The fields of a document as one text, whatever order they were written in. A field without a value is no field.
const fieldsOf = (document: object): string =>
  JSON.stringify(
    Object.entries(document)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );

/** What has to be written for the stored documents to be the wanted ones. */
export function mirrorChanges<T extends { id: string }>(wanted: readonly T[], stored: readonly T[]): MirrorChanges<T> {
  const before = new Map(stored.map((document) => [document.id, fieldsOf(document)]));
  const after = new Set(wanted.map((document) => document.id));
  return {
    set: wanted.filter((document) => before.get(document.id) !== fieldsOf(document)),
    remove: stored.filter((document) => !after.has(document.id)).map((document) => document.id),
  };
}

export const hasChanges = (changes: MirrorChanges<unknown>): boolean => changes.set.length > 0 || changes.remove.length > 0;
