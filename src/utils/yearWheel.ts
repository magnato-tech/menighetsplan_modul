// The congregation's annual wheel (årshjul): the administrative deadlines and the things that come
// back every year, month by month. It is a page of information in admin. Nobody is assigned to
// anything here, and nothing is sent out.
//
// A congregation that has not changed anything, sees the standard wheel (data/defaultYearWheel.ts).
// The first change stores the whole wheel, and from then on it is the congregation's own.

export interface YearWheelItem {
  id: string;
  /** 1 for January, 12 for December. */
  month: number;
  /** The day in the month the deadline is. */
  day: number;
  title: string;
  /** A few words more, when the title does not say it all. */
  note?: string;
}

export const MONTH_NAMES = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"] as const;

// February is given 29, so a deadline on leap day can be written
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** How many days the month can have. */
export const daysIn = (month: number): number => DAYS[month - 1] ?? 31;

export const YEAR_WHEEL_TITLE_MAX = 120;
export const YEAR_WHEEL_NOTE_MAX = 400;

/** Why the item cannot be stored, in words for the one who wrote it. Null when it can. */
export function yearWheelItemError(item: { month: number; day: number; title: string; note?: string }): string | null {
  if (item.title.trim() === "") return "Skriv hva fristen gjelder.";
  if (item.title.trim().length > YEAR_WHEEL_TITLE_MAX) return `Tittelen kan være opptil ${YEAR_WHEEL_TITLE_MAX} tegn.`;
  if ((item.note ?? "").trim().length > YEAR_WHEEL_NOTE_MAX) return `Notatet kan være opptil ${YEAR_WHEEL_NOTE_MAX} tegn.`;
  if (!Number.isInteger(item.month) || item.month < 1 || item.month > 12) return "Velg en måned.";
  if (!Number.isInteger(item.day) || item.day < 1 || item.day > daysIn(item.month)) return `${MONTH_NAMES[item.month - 1]} har ikke dag ${item.day}.`;
  return null;
}

/** An item as it is stored: trimmed, and without an empty note. */
export function cleanYearWheelItem(item: YearWheelItem): YearWheelItem {
  const note = item.note?.trim();
  return { id: item.id, month: item.month, day: item.day, title: item.title.trim(), ...(note ? { note } : {}) };
}

/** The items of each month, January first, each month by day and then by title. */
export function yearWheelByMonth(items: readonly YearWheelItem[]): { month: number; name: string; items: YearWheelItem[] }[] {
  return MONTH_NAMES.map((name, at) => ({
    month: at + 1,
    name,
    items: items.filter((item) => item.month === at + 1).sort((a, b) => a.day - b.day || a.title.localeCompare(b.title, "nb")),
  }));
}

/** The wheel with the item put in: in place of the one with the same id, or added. */
export function withYearWheelItem(items: readonly YearWheelItem[], item: YearWheelItem): YearWheelItem[] {
  const cleaned = cleanYearWheelItem(item);
  return items.some((other) => other.id === item.id) ? items.map((other) => (other.id === item.id ? cleaned : other)) : [...items, cleaned];
}

export function withoutYearWheelItem(items: readonly YearWheelItem[], id: string): YearWheelItem[] {
  return items.filter((item) => item.id !== id);
}

/** What a stored document holds, read without trusting it: only items that are whole are taken. */
export function yearWheelItemsOf(data: { items?: unknown } | undefined): YearWheelItem[] | null {
  if (!data || !Array.isArray(data.items)) return null;
  return data.items.flatMap((raw): YearWheelItem[] => {
    const item = raw as Partial<YearWheelItem> | null;
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.month !== "number" || typeof item.day !== "number") return [];
    const candidate: YearWheelItem = { id: item.id, month: item.month, day: item.day, title: item.title, ...(typeof item.note === "string" ? { note: item.note } : {}) };
    return yearWheelItemError(candidate) === null ? [cleanYearWheelItem(candidate)] : [];
  });
}
