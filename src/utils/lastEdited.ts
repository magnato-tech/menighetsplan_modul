// «Endret 22. nov. kl. 14:05 av Kristine Vik»: when a page or a news article was last saved, and by whom.
// Who is stored as a reference to the person in the register (`updatedBy`), never the name, because pages
// and news can be read by anyone. The name is looked up in admin; without it only the time is shown.

const MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** «22. nov.», «i dag» or «i går»; with `withTime`, «22. nov. kl. 14:05» / «i dag kl. 14:05». */
export function editedWhen(isoString: string, now: number, withTime: boolean): string | null {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.round((startOfDay(now) - startOfDay(date.getTime())) / DAY_MS);
  const day = days === 0 ? "i dag" : days === 1 ? "i går" : `${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]}`;
  const year = date.getFullYear() !== new Date(now).getFullYear() ? ` ${date.getFullYear()}` : "";
  return `${day}${days > 1 ? year : ""}${withTime ? ` kl. ${clock(date)}` : ""}`;
}

export interface LastEditedInput {
  updatedAt?: string;
  /** The person in the register who saved it last. */
  updatedBy?: string;
}

/**
 * «Endret 22. nov. kl. 14:05 av Kristine Vik», «Endret i går av Ola Hansen», or just «Endret 22. nov.» when
 * the name is not known. Null when there is no time to show.
 */
export function lastEditedText(
  item: LastEditedInput,
  nameOf: (personId: string) => string | undefined,
  now: number,
  options: { withTime?: boolean } = {}
): string | null {
  if (!item.updatedAt) return null;
  const when = editedWhen(item.updatedAt, now, options.withTime ?? false);
  if (!when) return null;
  const name = item.updatedBy ? nameOf(item.updatedBy)?.trim() : undefined;
  return `Endret ${when}${name ? ` av ${name}` : ""}`;
}
