import type { ProgramItem } from "../types";

// The programme's clock times follow from where it starts and how long each post lasts: each post starts
// when the one before it ends. The programme starts where its first post stands, which is normally the
// gathering's start; a post set before the start (a welcome at the door 15 minutes early) keeps its place. So a moved, added
// or removed post never leaves the times out of step. Programmes from before durations keep working: a
// post without a duration lasts until the next post's clock time.

/** A post whose length cannot be read from anything lasts this long. */
export const DEFAULT_DURATION_MINUTES = 10;

const DAY = 24 * 60;

/** "11:05" or "11.05" as minutes after midnight, or null when it is not a clock time. */
export function clockToMinutes(clock: string | undefined): number | null {
  const match = clock?.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Minutes after midnight as "HH:MM", wrapping past midnight. */
export function minutesToClock(total: number): string {
  const wrapped = ((Math.round(total) % DAY) + DAY) % DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** The clock time an ISO date shows in local time, as minutes after midnight. */
export function startMinutesOf(iso: string): number | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.getHours() * 60 + date.getMinutes();
}

/**
 * How long each post lasts: its own duration, else up to the next post's clock time, else (the last
 * post) up to the gathering's end, else DEFAULT_DURATION_MINUTES. Never below zero.
 */
export function durationsOf(items: readonly ProgramItem[], endsAt?: string): number[] {
  const end = endsAt ? startMinutesOf(endsAt) : null;
  return items.map((item, index) => {
    if (typeof item.durationMinutes === "number" && Number.isFinite(item.durationMinutes)) {
      return Math.max(0, Math.round(item.durationMinutes));
    }
    const from = clockToMinutes(item.time);
    const to = index + 1 < items.length ? clockToMinutes(items[index + 1].time) : end;
    if (from === null || to === null) return DEFAULT_DURATION_MINUTES;
    const gap = to - from;
    return gap >= 0 ? gap : DEFAULT_DURATION_MINUTES;
  });
}

/** Where the programme starts: its first post's clock time, else the gathering's start. */
export function programStartMinutes(items: readonly ProgramItem[], startsAt: string): number {
  return clockToMinutes(items[0]?.time) ?? startMinutesOf(startsAt) ?? 0;
}

/**
 * The programme with every post's duration filled in and its clock time worked out from where it starts.
 * This is what is saved after any change, so the stored times always match the durations. `startAt` is
 * given when the first post has just changed (moved or removed), so the programme keeps its old start.
 */
export function withComputedTimes(items: readonly ProgramItem[], startsAt: string, endsAt?: string, startAt?: number): ProgramItem[] {
  const durations = durationsOf(items, endsAt);
  let at = startAt ?? programStartMinutes(items, startsAt);
  return items.map((item, index) => {
    const next = { ...item, durationMinutes: durations[index], time: minutesToClock(at) };
    at += durations[index];
    return next;
  });
}

/** The programme with one post moved, every post keeping its duration and the times worked out again. */
export function moveProgramItem(items: readonly ProgramItem[], from: number, to: number, startsAt: string, endsAt?: string): ProgramItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  // Durations are fixed before the move, so a post without one keeps the length it had where it stood
  const durations = durationsOf(items, endsAt);
  const withDurations = items.map((item, index) => ({ ...item, durationMinutes: durations[index] }));
  const [moved] = withDurations.splice(from, 1);
  withDurations.splice(to, 0, moved);
  // The programme keeps its start, also when another post comes first
  return withComputedTimes(withDurations, startsAt, endsAt, programStartMinutes(items, startsAt));
}
