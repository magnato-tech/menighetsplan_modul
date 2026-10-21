// Earlier versions of a page or a news article, kept so a save that went wrong can be undone.
// Each time a page or an article is saved with a change, the version it replaces is kept as a copy.
// No database: the copies are stored by services/contentVersions.ts.

export type ContentKind = "page" | "news";

/** A version as it was stored before it was replaced. */
export interface ContentVersion {
  id: string;
  kind: ContentKind;
  /** The page or article it is a version of. */
  targetId: string;
  /** When this version was saved (the stored document's own time), and when it was replaced. */
  savedAt: string;
  replacedAt: string;
  title: string;
  /** The whole document as it was stored. */
  snapshot: Record<string, unknown>;
}

/** How many versions are kept of each page or article; the oldest beyond that are removed. */
export const MAX_VERSIONS = 30;

/** Fields that change with every save without the content changing. */
const NOT_CONTENT = new Set(["updatedAt", "updatedBy", "status", "publishedAt"]);

/** The content of a stored document, without the fields that change by themselves, in a fixed order. */
function contentOf(record: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(record)
      .filter((key) => !NOT_CONTENT.has(key) && record[key] !== undefined)
      .sort()
      .map((key) => [key, record[key]])
  );
}

/** Whether the document about to be stored differs in content from the one it replaces. */
export function contentChanged(previous: Record<string, unknown>, next: Record<string, unknown>): boolean {
  return contentOf(previous) !== contentOf(next);
}

/** The copy kept of a stored document when it is replaced. Fields without a value are left out. */
export function versionOf(
  kind: ContentKind,
  previous: { id: string; title?: string; updatedAt?: string; publishedAt?: string } & Record<string, unknown>,
  now: Date,
  makeId: () => string
): ContentVersion {
  const snapshot = Object.fromEntries(Object.entries(previous).filter(([, value]) => value !== undefined));
  return {
    id: makeId(),
    kind,
    targetId: previous.id,
    savedAt: previous.updatedAt || previous.publishedAt || now.toISOString(),
    replacedAt: now.toISOString(),
    title: previous.title || "",
    snapshot,
  };
}

/** Newest first. */
export function byNewest(a: Pick<ContentVersion, "replacedAt">, b: Pick<ContentVersion, "replacedAt">): number {
  return b.replacedAt.localeCompare(a.replacedAt);
}

/** The versions to remove so no more than MAX_VERSIONS are kept, the oldest first. */
export function versionsToPrune(versions: ContentVersion[], max = MAX_VERSIONS): string[] {
  return [...versions].sort(byNewest).slice(max).map((version) => version.id);
}

/**
 * What the editor is given back when a version is restored: the old content in place of the new,
 * and nothing of the editor's own working state. The page's id stays, so Lagre stores it on the same
 * page, and the restore is not stored until Lagre is pressed.
 */
export function restoredFields(version: ContentVersion): Record<string, unknown> {
  const { updatedAt: _updated, status: _status, ...fields } = version.snapshot;
  return { ...fields, id: version.targetId, blocks: undefined };
}
