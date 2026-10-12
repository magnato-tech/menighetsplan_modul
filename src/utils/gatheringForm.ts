import type { NewGatheringInput } from "../data/newDocuments";
import type { Gathering, GatheringVisibility } from "../types";
import { combineDateAndTimeToIso, parseIsoToDateAndTime } from "./dates";
import { isWorshipService } from "./gatherings";
import { visibilityFields, visibilityOf } from "./visibility";

// The form an event is made and changed in: what its fields hold, when they can be saved, and
// what is stored from them. The same form is used for a new event and for one that exists, so
// an event has the same fields whichever way it is reached.

export interface GatheringFormValues {
  title: string;
  /** The day it starts, "2026-10-18", and the time, "11:00". */
  date: string;
  time: string;
  /** The day it ends. Empty when it ends the day it starts. */
  endDate: string;
  /** The time it ends. Empty when no end is given. */
  endTime: string;
  location: string;
  /** The group responsible. */
  groupId: string;
  isGudstjeneste: boolean;
  theme: string;
  bibleText: string;
  visibility: GatheringVisibility;
  cancelled: boolean;
}

/** A form for a new event: open to everyone, a worship service at 11:00, and the rest empty. */
export function newGatheringForm(start: Partial<GatheringFormValues> = {}): GatheringFormValues {
  return {
    title: "",
    date: "",
    time: "11:00",
    endDate: "",
    endTime: "",
    location: "",
    groupId: "",
    isGudstjeneste: true,
    theme: "",
    bibleText: "",
    visibility: "offentlig",
    cancelled: false,
    ...start,
  };
}

/** The form filled in from an event as it is stored. */
export function formOfGathering(gathering: Gathering): GatheringFormValues {
  const start = parseIsoToDateAndTime(gathering.startsAt);
  const end = gathering.endsAt ? parseIsoToDateAndTime(gathering.endsAt) : null;
  return {
    title: gathering.title,
    date: start.date,
    time: start.time,
    endDate: end && end.date !== start.date ? end.date : "",
    endTime: end ? end.time : "",
    location: gathering.location ?? "",
    groupId: gathering.groupId,
    isGudstjeneste: isWorshipService(gathering),
    theme: gathering.theme ?? "",
    bibleText: gathering.bibleText ?? "",
    visibility: visibilityOf(gathering),
    cancelled: gathering.cancelled === true,
  };
}

const startOf = (values: GatheringFormValues): string => combineDateAndTimeToIso(values.date, values.time || "11:00");

/** The moment the event ends, or undefined when the form gives no end. */
const endOf = (values: GatheringFormValues): string | undefined =>
  values.endTime ? combineDateAndTimeToIso(values.endDate || values.date, values.endTime) : undefined;

/** Why the form cannot be saved as it stands, said to the one filling it in. Null when it can. */
export function gatheringFormError(values: GatheringFormValues): string | null {
  if (!values.title.trim()) return "Arrangementet må ha en tittel.";
  if (!values.date) return "Arrangementet må ha en dato.";
  if (!values.groupId) return "Opprett en gruppe først. Et arrangement må ha en ansvarlig gruppe.";
  if (values.endDate && !values.endTime) return "Sett et klokkeslett for slutten, eller ta bort sluttdatoen.";
  const end = endOf(values);
  if (end && new Date(end).getTime() <= new Date(startOf(values)).getTime()) return "Slutten må være etter starten.";
  return null;
}

const filled = (text: string): string | undefined => text.trim() || undefined;

/** What a new event is made from. */
export function newGatheringOf(values: GatheringFormValues): NewGatheringInput {
  return {
    groupId: values.groupId,
    title: values.title.trim(),
    startsAt: startOf(values),
    endsAt: endOf(values),
    location: filled(values.location),
    type: "arrangement",
    theme: filled(values.theme),
    bibleText: filled(values.bibleText),
    visibility: values.visibility,
    isGudstjeneste: values.isGudstjeneste,
    cancelled: values.cancelled,
  };
}

/**
 * What is stored on an event that exists. A field that has been emptied is undefined, which
 * takes it away in the database. The group is only among them when the form asks for it.
 */
export function gatheringUpdatesOf(values: GatheringFormValues, withGroup: boolean): Partial<Gathering> {
  return {
    title: values.title.trim(),
    startsAt: startOf(values),
    endsAt: endOf(values),
    location: filled(values.location),
    theme: filled(values.theme),
    bibleText: filled(values.bibleText),
    ...visibilityFields(values.visibility),
    isGudstjeneste: values.isGudstjeneste,
    cancelled: values.cancelled,
    ...(withGroup ? { groupId: values.groupId } : {}),
  };
}

type GroupLike = { id: string; memberIds?: string[]; leaderIds?: string[] };

/**
 * The group a new event belongs to before anyone has chosen one. With the planner it is the
 * first group. Without it nobody chooses, and the event goes to the group that only holds the
 * calendar (one with no members and no leaders), or to the first group when there is no such.
 */
export function defaultGroupId(groups: readonly GroupLike[], withPlanner: boolean): string {
  const calendar = withPlanner ? undefined : groups.find((group) => !group.memberIds?.length && !group.leaderIds?.length);
  return (calendar ?? groups[0])?.id ?? "";
}
