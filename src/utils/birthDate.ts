// A person's date of birth, as the register keeps it: a calendar day, "1980-03-12", with no
// time of day and no time zone. It is the same day wherever it is read.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

interface Parts {
  year: number;
  month: number;
  day: number;
}

/** The year, month and day of "1980-03-12". Null when the text is not a day that exists. */
function partsOf(value: string | undefined): Parts | null {
  const match = (value ?? "").match(DAY);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // The 31st of February is not a day: the calendar would move it into March
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null;
}

/** Today as a calendar day in Norway. */
export function todayInNorway(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(now);
}

/** Why the text cannot be a date of birth, in words for the one who wrote it. Null when it can, and when it is empty. */
export function birthDateError(value: string, today: string = todayInNorway()): string | null {
  if (value.trim() === "") return null;
  if (!partsOf(value)) return "Fødselsdatoen er ikke en gyldig dato.";
  if (value > today) return "Fødselsdatoen kan ikke være fram i tid.";
  if (value < "1900-01-01") return "Fødselsdatoen er for langt tilbake. Sjekk årstallet.";
  return null;
}

/** How old someone born on the day is on `today`, in whole years. Null without a valid date of birth. */
export function ageOn(birthDate: string | undefined, today: string = todayInNorway()): number | null {
  const born = partsOf(birthDate);
  const now = partsOf(today);
  if (!born || !now || birthDate! > today) return null;
  const hadBirthday = now.month > born.month || (now.month === born.month && now.day >= born.day);
  return now.year - born.year - (hadBirthday ? 0 : 1);
}

/** The date of birth as it is read: "12. mars 1980". Empty without a valid one. */
export function formatBirthDate(birthDate: string | undefined): string {
  const born = partsOf(birthDate);
  return born ? `${born.day}. ${MONTHS[born.month - 1]} ${born.year}` : "";
}
