// Norwegian text for the date and time fields of a form. The browser's own date and time inputs
// follow the browser's language, so an English browser shows mm/dd/yyyy and am/pm. These functions
// show and read dd.mm.åååå and tt:mm, while the form keeps ISO days ("2027-01-10") and "HH:MM".

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The number of days in a month, 1-based month. Years are set explicitly, so 0027 is not read as 1927. */
function daysInMonth(year: number, month: number): number {
  const d = new Date(Date.UTC(2000, 0, 1));
  d.setUTCFullYear(year, month, 0);
  return d.getUTCDate();
}

/** "2027-01-10" to "10.01.2027". Anything else, such as "", gives "". */
export function dayToNorwegian(day: string): string {
  const match = ISO_DAY.exec(day);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * "10.01.2027", "10.1.2027", "1.1.2027", "10/01/2027" or "10-01-2027" to "2027-01-10". Returns ""
 * when the text is not a real calendar date, such as "31.02.2027" or a two-digit year.
 */
export function norwegianToDay(text: string): string {
  const match = /^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/.exec(text.trim());
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[3]);
  const year = Number(match[4]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return "";
  return `${match[4]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A valid "HH:MM" is kept as it is. Anything else gives "". */
export function clockToNorwegian(clock: string): string {
  return CLOCK.test(clock) ? clock : "";
}

/**
 * "21:00", "21.00", "9:00", "0900", "2100" or "21" to a 24-hour "HH:MM", such as "09:00". Returns ""
 * for an hour above 23, a minute above 59, or anything else.
 */
export function norwegianToClock(text: string): string {
  const value = text.trim();
  const match = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(value) ?? /^(\d{2})(\d{2})$/.exec(value) ?? /^(\d)(\d{2})$/.exec(value);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
