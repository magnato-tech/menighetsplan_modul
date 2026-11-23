// The recycle bin («Papirkurven»): a deleted page, news article or talk is kept for 30 days, and can be
// put back as it was. It is stored as a record in the same place as the earlier versions (see
// utils/contentVersions.ts and services/contentVersions.ts), marked `deleted`. A page deleted with its
// sub-pages gets one record per page, all with the same `deletionGroup`, so they come back together.

import type { ContentKind } from "./contentVersions";

/** How many days a deleted item is kept before it is removed for good. */
export const TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One deleted page, article or talk, as it is stored. */
export interface TrashRecord {
  id: string;
  kind: ContentKind;
  /** The id the page, article or talk had, and gets back when restored. */
  targetId: string;
  title: string;
  deleted: true;
  deletedAt: string;
  /** The person in the register who deleted it, when known. */
  deletedBy?: string;
  /** The same for every page deleted together (the page and its sub-pages). */
  deletionGroup: string;
  /** True for the page that was chosen, false for its sub-pages. */
  root: boolean;
  /** The whole document as it was stored. */
  snapshot: Record<string, unknown>;
}

/** What is shown and restored as one line: a page with its sub-pages, or one article or talk. */
export interface TrashItem {
  kind: ContentKind;
  title: string;
  deletedAt: string;
  deletedBy?: string;
  deletionGroup: string;
  members: TrashRecord[];
}

/** The record for one deleted document, in the form it is stored in. */
export function trashRecordOf(
  id: string,
  kind: ContentKind,
  document: { id: string; title?: string },
  details: { deletedAt: string; deletedBy?: string; deletionGroup: string; root: boolean }
): TrashRecord {
  const snapshot = Object.fromEntries(Object.entries(document).filter(([, value]) => value !== undefined));
  return {
    id,
    kind,
    targetId: document.id,
    title: document.title || "",
    deleted: true,
    deletedAt: details.deletedAt,
    ...(details.deletedBy ? { deletedBy: details.deletedBy } : {}),
    deletionGroup: details.deletionGroup,
    root: details.root,
    snapshot,
  };
}

/** Whether a record has been in the recycle bin for longer than TRASH_DAYS. */
export function isExpired(deletedAt: string, now: number): boolean {
  return now - new Date(deletedAt).getTime() > TRASH_DAYS * DAY_MS;
}

/** The day the item is removed for good: TRASH_DAYS after it was deleted. */
export function removedForGoodAt(deletedAt: string): string {
  return new Date(new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS).toISOString();
}

/** The items in the recycle bin, newest first. Records of one deletion group become one item. */
export function groupTrash(records: TrashRecord[]): TrashItem[] {
  const groups = new Map<string, TrashRecord[]>();
  for (const record of records) groups.set(record.deletionGroup, [...(groups.get(record.deletionGroup) ?? []), record]);
  return [...groups.values()]
    .map((members) => {
      const root = members.find((m) => m.root) ?? members[0];
      return {
        kind: root.kind,
        title: root.title,
        deletedAt: root.deletedAt,
        ...(root.deletedBy ? { deletedBy: root.deletedBy } : {}),
        deletionGroup: root.deletionGroup,
        members: [...members].sort((a, b) => (a.root === b.root ? 0 : a.root ? -1 : 1)),
      };
    })
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

/** What the item is called in the list: «Om oss (med 5 undersider)». */
export function trashLabel(item: Pick<TrashItem, "title" | "members">): string {
  const subPages = item.members.length - 1;
  if (subPages <= 0) return item.title;
  return `${item.title} (med ${subPages} ${subPages === 1 ? "underside" : "undersider"})`;
}

/** What the item is, in the list. */
export const TRASH_KIND_NAMES: Record<ContentKind, string> = { page: "Side", news: "Nyhet", sermon: "Tale" };
