// What "Trenger din oppmerksomhet" on Min side can hold, and how each kind reads.

interface AttentionBase {
  id: string;
  title: string;
  /** Empty when the gathering is unknown. */
  startsAt: string;
  location?: string;
  groupName?: string;
  /** The role the task is for, when it has one. A task without a role is known by its title. */
  role?: string;
}

export type AttentionItem =
  /** A leader has asked the user to take a task. */
  | (AttentionBase & { type: "task_request"; assignmentId: string; taskDescription?: string })
  /** A gathering in one of the user's groups that they have not answered. */
  | (AttentionBase & { type: "unanswered_invitation"; gatheringId: string; theme?: string })
  /** A task in one of the user's groups with a free slot. */
  | (AttentionBase & { type: "open_task"; taskId: string; taskDescription?: string; needsSubstitute: boolean });

export interface AttentionText {
  label: string;
  note?: string;
  /** The button that says yes. */
  yes: string;
  /** The button that says no, for the kinds that can be turned down. */
  no?: string;
}

export function attentionText(item: AttentionItem): AttentionText {
  switch (item.type) {
    case "task_request":
      return { label: "Forespørsel til deg", note: item.taskDescription, yes: "Ja, jeg kan", no: "Kan ikke" };
    case "unanswered_invitation":
      return { label: "Innkalling", note: item.theme ? `Tema: ${item.theme}` : undefined, yes: "Kommer", no: "Kan ikke" };
    case "open_task":
      return {
        // "Vikar" only when someone has pulled out at short notice; otherwise the task was simply never filled
        label: item.needsSubstitute ? "Trenger vikar" : "Ledig oppgave",
        note: item.taskDescription,
        yes: "Ta oppgave",
      };
  }
}

// ---------- Narrowing a long list ----------
//
// Someone in many groups can have dozens of free tasks. The list is narrowed with tags, one for
// each role there is a task for. Any number can be pressed, and what is shown, is what has one of
// them. With none pressed, everything is shown.

/** The tag for the gatherings one is called to, which have no role. */
export const INVITATION_TAG = "Innkalling";

/** The tag an item is found by: the role the task is for, or the task's own title when it has no role. */
export function attentionTagOf(item: AttentionItem): string {
  return item.type === "unanswered_invitation" ? INVITATION_TAG : (item.role || item.title).trim();
}

/** The tags of a list, by name, each with how many items it has. */
export function attentionTags(items: readonly AttentionItem[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(attentionTagOf(item), (counts.get(attentionTagOf(item)) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag, "nb"));
}

/** The items that have one of the chosen tags. All of them when none is chosen. */
export function withAttentionTags<T extends AttentionItem>(items: readonly T[], chosen: ReadonlySet<string>): T[] {
  return chosen.size === 0 ? [...items] : items.filter((item) => chosen.has(attentionTagOf(item)));
}
