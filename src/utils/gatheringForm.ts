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
  // How the event is presented on the website (see utils/gatheringPresentation.ts)
  imageUrl: string;
  imageAlt: string;
  imageFocus: string;
  summary: string;
  content: string;
  linkUrl: string;
  linkLabel: string;
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
    imageUrl: "",
    imageAlt: "",
    imageFocus: "",
    summary: "",
    content: "",
    linkUrl: "",
    linkLabel: "",
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
    imageUrl: gathering.imageUrl ?? "",
    imageAlt: gathering.imageAlt ?? "",
    imageFocus: gathering.imageFocus ?? "",
    summary: gathering.summary ?? "",
    content: gathering.content ?? "",
    linkUrl: gathering.linkUrl ?? "",
    linkLabel: gathering.linkLabel ?? "",
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
  const link = values.linkUrl.trim();
  if (link && !/^(https?:\/\/|\/)\S+$/.test(link)) return "Lenken må starte med https:// eller /.";
  return null;
}

const filled = (text: string): string | undefined => text.trim() || undefined;

/** The presentation on the website, as it is stored. A text on the button without a link is nothing, and neither is a description of a picture that is not there. */
const presentationOf = (values: GatheringFormValues): Partial<Gathering> => ({
  imageUrl: filled(values.imageUrl),
  imageAlt: filled(values.imageUrl) ? filled(values.imageAlt) : undefined,
  imageFocus: filled(values.imageUrl) ? filled(values.imageFocus) : undefined,
  summary: filled(values.summary),
  content: filled(values.content),
  linkUrl: filled(values.linkUrl),
  linkLabel: filled(values.linkUrl) ? filled(values.linkLabel) : undefined,
});

/** Whether the form holds anything about how the event is presented on the website. */
export const hasPresentation = (values: GatheringFormValues): boolean => Object.values(presentationOf(values)).some((value) => value !== undefined);

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
    ...presentationOf(values),
  };
}

/**
 * What is stored on an event that exists. A field that has been emptied is undefined, which
 * takes it away in the database. The group is only among them when the form asks for it.
 */
/**
 * What a web editor stores of an event: its presentation on the website only, never the time, the
 * place, the group or the staffing (the database rules let them write nothing else on an event).
 */
export const websiteUpdatesOf = (values: GatheringFormValues): Partial<Gathering> => presentationOf(values);

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
    ...presentationOf(values),
    ...(withGroup ? { groupId: values.groupId } : {}),
  };
}

const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`);

/**
 * The form's values for the same event on another day: one of the days of a series. An event
 * that ends on a later day than it starts, ends as many days later here.
 */
export function onDay(values: GatheringFormValues, day: string): GatheringFormValues {
  if (!values.endDate || !values.date) return { ...values, date: day };
  const length = dayNumber(values.endDate) - dayNumber(values.date);
  return { ...values, date: day, endDate: new Date(dayNumber(day) + length).toISOString().slice(0, 10) };
}

type GroupLike = { id: string; memberIds?: string[]; leaderIds?: string[]; deputyLeaderIds?: string[] };

/**
 * The group a new event belongs to before anyone has chosen one: the group that only holds the
 * calendar, so that no group is made responsible for an event by standing first in a list. That
 * group has no members and no leaders. A service group nobody has been put in yet, looks the
 * same, so of several the one with the most events is taken. Where there is no such group, the
 * event goes to the first group.
 */
export function defaultGroupId(groups: readonly GroupLike[], gatherings: readonly { groupId: string }[] = []): string {
  const eventsOf = (group: GroupLike) => gatherings.filter((gathering) => gathering.groupId === group.id).length;
  const holdingOnlyTheCalendar = groups
    .filter((group) => !group.memberIds?.length && !group.leaderIds?.length && !group.deputyLeaderIds?.length)
    .map((group) => ({ group, events: eventsOf(group) }))
    .sort((a, b) => b.events - a.events);
  return (holdingOnlyTheCalendar[0]?.group ?? groups[0])?.id ?? "";
}
