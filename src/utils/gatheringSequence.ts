import type { Gathering, Group } from "../types";
import { calendarKindOf } from "./adminCalendar";

// The gatherings the arrows on the gathering page step through: the series it belongs to, the
// church services, or the gatherings of the same kind in the same group. Pure; the caller decides
// which gatherings the reader can open, and passes only those.

/** A gathering with its group, read the way the admin calendar reads it. */
export interface SequenceItem {
  gathering: Gathering;
  group?: Pick<Group, "category">;
}

const startOf = (item: SequenceItem) => new Date(item.gathering.startsAt).getTime();

/**
 * The gatherings the arrows step through, by start. A series is the gatherings with the same
 * `seriesId`. A church service is every service, whatever its group. Anything else is the gatherings of
 * the same calendar kind in the same group. Cancelled gatherings are kept: they are real dates.
 */
export function gatheringSequence(current: SequenceItem, all: SequenceItem[]): SequenceItem[] {
  const pool = all.some((item) => item.gathering.id === current.gathering.id) ? all : [...all, current];
  const kind = calendarKindOf(current.gathering, current.group);
  const seriesId = current.gathering.seriesId;

  const inSequence = (item: SequenceItem) => {
    if (seriesId) return item.gathering.seriesId === seriesId;
    if (kind === "gudstjenester") return calendarKindOf(item.gathering, item.group) === "gudstjenester";
    return calendarKindOf(item.gathering, item.group) === kind && item.gathering.groupId === current.gathering.groupId;
  };

  return pool
    .filter(inSequence)
    .sort((a, b) => startOf(a) - startOf(b) || a.gathering.id.localeCompare(b.gathering.id));
}

/** Where a gathering stands in its sequence, and the gatherings on each side of it. */
export function neighbours(sequence: SequenceItem[], currentId: string) {
  const index = sequence.findIndex((item) => item.gathering.id === currentId);
  return {
    previous: index > 0 ? sequence[index - 1] : undefined,
    next: index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : undefined,
    index,
    total: sequence.length,
  };
}

/** The list the date opens: a few before the current gathering and more after it, in order. */
export function nearbySequence(sequence: SequenceItem[], currentId: string, before = 3, after = 10): SequenceItem[] {
  const index = sequence.findIndex((item) => item.gathering.id === currentId);
  if (index < 0) return sequence.slice(0, before + after + 1);
  return sequence.slice(Math.max(0, index - before), index + after + 1);
}
