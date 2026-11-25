import { useState } from "react";
import { useFirebase } from "../../context/FirebaseDataContext";
import { formatNorwegianDateTime } from "../../utils/dates";
import type { Assignment, Gathering, Task } from "../../types";
import { useConfirm } from "../ConfirmProvider";
import { DeleteGatheringDialog, type StaffedTask } from "../../pages/admin/DeleteGatheringDialog";
import { dismissExternalEvent } from "../../services/surfaces";
import { reportWriteError } from "../../services/writeErrors";

export interface GatheringDeleteQuestion {
  title: string;
  when: string;
  programCount: number;
  taskCount: number;
  inSeries: boolean;
  /** The event came from kirkens kalender (it has an externalCalendarUid). */
  fromCalendar?: boolean;
}

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * The question before an event is deleted, as the Kalender list and the event page both ask it. It
 * says what goes with the event, with the real counts, and that it cannot be undone.
 */
export function gatheringDeleteQuestion({ title, when, programCount, taskCount, inSeries, fromCalendar }: GatheringDeleteQuestion): string {
  const lines = [`Vil du slette «${title}» (${when})?`];
  const gone =
    programCount > 0 && taskCount > 0
      ? `Programmet (${counted(programCount, "post", "poster")}) og ${counted(taskCount, "oppgave", "oppgaver")} slettes også.`
      : programCount > 0
        ? `Programmet (${counted(programCount, "post", "poster")}) slettes også.`
        : taskCount > 0
          ? `${counted(taskCount, "oppgave", "oppgaver")} slettes også.`
          : "";
  lines.push([gone, "Dette kan ikke angres."].filter(Boolean).join(" "));
  if (inSeries) lines.push("Bare dette arrangementet slettes, ikke resten av serien.");
  if (fromCalendar) {
    lines.push("Arrangementet kom fra kirkens kalender. Det blir ikke hentet inn igjen, men du finner det under «Avvist og slettet».");
  }
  return lines.join("\n");
}

/**
 * Remembers a deleted event that came from kirkens kalender, so the feed does not bring it back.
 * Shown under «Avvist og slettet» in the import panel. Events without a calendar uid are left alone.
 */
export function rememberDeletedCalendarEvent(gathering: Gathering): void {
  if (!gathering.externalCalendarUid) return;
  dismissExternalEvent(gathering.externalCalendarUid, {
    reason: "slettet",
    at: new Date().toISOString(),
    title: gathering.title,
    startsAt: gathering.startsAt,
  }).catch((error: unknown) => reportWriteError("huske slettet arrangement fra kalenderen", error));
}

/** The people on an event's tasks: confirmed, and those who are asked. Nobody else. */
function staffedTasksOf(tasks: Task[], assignments: Assignment[], nameOf: (personId: string) => string | undefined): StaffedTask[] {
  return tasks.flatMap((task) => {
    const people = assignments
      .filter((assignment) => assignment.taskId === task.id && (assignment.response === "confirmed" || assignment.response === "pending"))
      .map((assignment) => ({
        name: nameOf(assignment.personId) ?? assignment.personName ?? "Ukjent person",
        asked: assignment.response === "pending",
      }));
    return people.length > 0 ? [{ title: task.title, people }] : [];
  });
}

/**
 * Deleting an event, the same from the Kalender list and from the event page. With people on its
 * tasks, the list of who is taken off comes first (DeleteGatheringDialog); otherwise one question.
 * `onDone` gets the result, and whether people were taken off the tasks.
 */
export function useGatheringDeletion(onDone: (result: { success: boolean; error?: string }, withPeople: boolean) => void) {
  const confirmInPage = useConfirm();
  const { assignments, getPersonById, deleteGatheringWithStaffing } = useFirebase();
  const [staffedEvent, setStaffedEvent] = useState<{ gathering: Gathering; staffed: StaffedTask[] } | null>(null);

  const deleteNow = (gathering: Gathering, withPeople: boolean) => {
    const result = deleteGatheringWithStaffing(gathering.id);
    if (result.success) rememberDeletedCalendarEvent(gathering);
    onDone(result, withPeople);
  };

  const requestDelete = async (gathering: Gathering, tasks: Task[]) => {
    const staffed = staffedTasksOf(tasks, assignments, (personId) => getPersonById(personId)?.name);
    if (staffed.length > 0) {
      setStaffedEvent({ gathering, staffed });
      return;
    }
    const when = formatNorwegianDateTime(gathering.startsAt);
    const ok = await confirmInPage(
      gatheringDeleteQuestion({
        title: gathering.title,
        when,
        programCount: gathering.programSchedule?.length ?? 0,
        taskCount: tasks.length,
        inSeries: Boolean(gathering.seriesId),
        fromCalendar: Boolean(gathering.externalCalendarUid),
      }),
      { yes: "Slett arrangementet", danger: true }
    );
    if (ok) deleteNow(gathering, false);
  };

  const staffedDialog = staffedEvent ? (
    <DeleteGatheringDialog
      title={staffedEvent.gathering.title}
      when={formatNorwegianDateTime(staffedEvent.gathering.startsAt)}
      staffed={staffedEvent.staffed}
      inSeries={Boolean(staffedEvent.gathering.seriesId)}
      fromCalendar={Boolean(staffedEvent.gathering.externalCalendarUid)}
      onConfirm={() => {
        const { gathering } = staffedEvent;
        setStaffedEvent(null);
        deleteNow(gathering, true);
      }}
      onClose={() => setStaffedEvent(null)}
    />
  ) : null;

  return { requestDelete, staffedDialog };
}
