// Dates and clock times as the planner shows them, in the time zone of the person looking.

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];
const MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const twoDigits = (value: number) => String(value).padStart(2, "0");
const clockOf = (date: Date) => `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
const isSameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

/** The date, or null when the text is not one. Every formatter below shows such a text as it is. */
function parse(isoString: string): Date | null {
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? null : date;
}

/** "Søndag 1. nov. kl. 11:00" */
export function formatNorwegianDateTime(isoString: string): string {
  const date = parse(isoString);
  if (!date) return isoString;
  return `${capitalize(WEEKDAYS[date.getDay()])} ${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]} kl. ${clockOf(date)}`;
}

const WEEKDAYS_SHORT = ["søn.", "man.", "tir.", "ons.", "tor.", "fre.", "lør."];

/** "søn. 1. nov. · 11:00", for the short lists of dates. */
export function formatNorwegianShortDateTime(isoString: string): string {
  const date = parse(isoString);
  if (!date) return isoString;
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]} · ${clockOf(date)}`;
}

/** A chat message's time: "I dag kl. 08:15", "I går kl. 21:40", or "1. sep. kl. 13:00" for older ones. */
export function formatChatMessageTime(isoString: string): string {
  const date = parse(isoString);
  if (!date) return isoString;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return `I dag kl. ${clockOf(date)}`;
  if (isSameDay(date, yesterday)) return `I går kl. ${clockOf(date)}`;
  return `${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]} kl. ${clockOf(date)}`;
}

/** "søndag 16. august 2026 · 11:00 · Hovedsalen · Gudstjeneste", the last two parts when given. */
export function formatCompactGatheringSubtitle(isoString: string, location?: string, typeOrGroup?: string): string {
  const date = parse(isoString);
  if (!date) return isoString;

  const day = `${WEEKDAYS[date.getDay()]} ${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return [day, clockOf(date), location, typeOrGroup].filter(Boolean).join(" · ");
}

/** A stored moment as the values of a date field and a time field. */
export function parseIsoToDateAndTime(isoString: string): { date: string; time: string } {
  const d = parse(isoString);
  if (!d) return { date: "", time: "11:00" };
  return {
    date: `${d.getFullYear()}-${twoDigits(d.getMonth() + 1)}-${twoDigits(d.getDate())}`,
    time: clockOf(d),
  };
}

/**
 * A date field and a time field as one exact moment. Without a time, 11:00 is used.
 * Values that do not make a date give the present moment.
 */
export function combineDateAndTimeToIso(dateStr: string, timeStr: string): string {
  try {
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const [hh, min] = (timeStr || "11:00").split(":").map(Number);
    const d = new Date(yyyy, mm - 1, dd, hh || 0, min || 0, 0);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * A stored moment moved a number of whole days, at the same time of day for the person looking:
 * 11:00 stays 11:00, also across a change between summer and winter time. A text that is not a
 * moment is given back as it is.
 */
export function moveByDays(isoString: string, days: number): string {
  const d = parse(isoString);
  if (!d || !Number.isFinite(days)) return isoString;
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString();
}

/** The month a moment falls in for the person looking, as "2026-10". Empty when the text is not a date. */
export function monthKeyOf(isoString: string): string {
  return parseIsoToDateAndTime(isoString).date.slice(0, 7);
}

/** The months that have something in them, in order, for a month filter: `{ id: "2026-10", label: "Okt 2026" }`. */
export function monthOptionsOf(isoStrings: string[]): { id: string; label: string }[] {
  const keys = Array.from(new Set(isoStrings.map(monthKeyOf).filter(Boolean))).sort();
  return keys.map((id) => {
    const [year, month] = id.split("-").map(Number);
    return { id, label: `${capitalize(MONTHS_SHORT[month - 1].replace(".", ""))} ${year}` };
  });
}
