import type { CmsNewsArticle } from "../data/cmsData";
import type { Gathering } from "../types";

// How long a news article is shown on the website.
//
// An article stands until it is taken out, unless it has a last day. The last day is the date
// set on the article («Vises til og med»). Without one it is the day of the event the article
// belongs to: an article about an event is news until the event has been held, and it follows
// the event when the event is moved. The day is the day the calendar shows in Norway, and the
// article is shown through it.
//
// Past its last day an article is no longer in the lists on the website. It is still there for
// someone who has its address, and it stays in the admin, where it can be given a new date.

type Dated = Pick<CmsNewsArticle, "expiresAt" | "gatheringRefId">;
/** An article from before the mark for a draft existed has none, and counts as published. */
type Published = Dated & { isPublished?: boolean };
type Event = Pick<Gathering, "id" | "startsAt" | "endsAt">;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NORWEGIAN_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" });

/** The day the calendar shows in Norway at a moment: "2026-10-11". */
export const norwegianDayOf = (moment: number): string => NORWEGIAN_DAY.format(new Date(moment));

/** The date set on the article itself, or null when none is, or when what is stored is not a date. */
const ownLastDay = (article: Dated): string | null => {
  const day = article.expiresAt?.trim() ?? "";
  return DAY.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? day : null;
};

export interface LastDay {
  day: string;
  /** Whether the day is the date set on the article, or the day of the event it belongs to. */
  from: "date" | "event";
}

/**
 * The last day an article is shown, or null when it stands until it is taken out. A date set on
 * the article decides. An event that lasts over several days counts to its end. An article
 * whose event is gone has nothing to go by, and stands.
 */
export function lastDayOf(article: Dated, gatherings: readonly Event[]): LastDay | null {
  const own = ownLastDay(article);
  if (own) return { day: own, from: "date" };

  const event = article.gatheringRefId ? gatherings.find((gathering) => gathering.id === article.gatheringRefId) : undefined;
  if (!event) return null;
  const end = Date.parse(event.endsAt || event.startsAt);
  return Number.isNaN(end) ? null : { day: norwegianDayOf(end), from: "event" };
}

/** Whether the article is past its last day. */
export function isNewsExpired(article: Dated, gatherings: readonly Event[], now: number): boolean {
  const last = lastDayOf(article, gatherings);
  return last !== null && norwegianDayOf(now) > last.day;
}

/**
 * Whether the article is in the lists on the website now: published, and not past its last day.
 *
 * `gatherings` is null until the events have arrived. An article that waits for its event to say
 * how long it is shown, is held back until then, so one that is over is not flashed first.
 */
export function isNewsShown(article: Published, gatherings: readonly Event[] | null, now: number): boolean {
  if (article.isPublished === false) return false;
  if (gatherings !== null) return !isNewsExpired(article, gatherings, now);
  if (ownLastDay(article)) return !isNewsExpired(article, [], now);
  return !article.gatheringRefId;
}

/** The articles in the lists on the website, in the order they came. */
export function shownNews<T extends Published>(news: readonly T[], gatherings: readonly Event[] | null, now: number): T[] {
  return news.filter((article) => isNewsShown(article, gatherings, now));
}

// An article about an event that is not in the calendar has no last day unless one is set, and stands on
// the website after the event. When such an article is saved, the editor is asked for a last day, and
// the latest date the article itself mentions is offered.

const MONTHS: Record<string, number> = {
  januar: 1, jan: 1, februar: 2, feb: 2, mars: 3, mar: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6,
  juli: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9, oktober: 10, okt: 10,
  november: 11, nov: 11, desember: 12, des: 12,
};
const WRITTEN_DATE = /\b(\d{1,2})\.\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sept|sep|okt|nov|des)\b\.?(?:\s+(\d{4}))?/gi;
// Only with the year: «19.30» is a time, and «16.10» may be one
const NUMERIC_DATE = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
const HALF_YEAR_MS = 183 * 86_400_000;

const isoDay = (year: number, month: number, day: number): string | null => {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day ? iso : null;
};

/**
 * The dates a text mentions, as days ("2026-10-16"), in the order they stand. «16. oktober» without a
 * year is taken in the year that puts it nearest to `now`: in December, «4. januar» is next year.
 */
export function datesMentioned(text: string, now: number): string[] {
  const days: string[] = [];
  const thisYear = Number(norwegianDayOf(now).slice(0, 4));
  for (const match of text.matchAll(WRITTEN_DATE)) {
    const day = Number(match[1]);
    const month = MONTHS[match[2].toLowerCase()];
    let year = match[3] ? Number(match[3]) : thisYear;
    if (!match[3]) {
      const at = Date.parse(`${year}-${String(month).padStart(2, "0")}-01T12:00:00Z`);
      if (at < now - HALF_YEAR_MS) year += 1;
      else if (at > now + HALF_YEAR_MS) year -= 1;
    }
    const iso = isoDay(year, month, day);
    if (iso) days.push(iso);
  }
  for (const match of text.matchAll(NUMERIC_DATE)) {
    const iso = isoDay(Number(match[3]), Number(match[2]), Number(match[1]));
    if (iso) days.push(iso);
  }
  return days;
}

/** The last day to offer for an article without one: the latest date its title, ingress and text mention. */
export function suggestedLastDay(article: Partial<Pick<CmsNewsArticle, "title" | "summary" | "content">>, now: number): string | null {
  const days = datesMentioned([article.title, article.summary, article.content].filter(Boolean).join(" "), now);
  return days.length > 0 ? days.reduce((latest, day) => (day > latest ? day : latest)) : null;
}

/** Whether saving the article should ask for a last day: it is published, and nothing ends it. */
export function needsLastDay(article: Published, gatherings: readonly Event[]): boolean {
  return article.isPublished !== false && lastDayOf(article, gatherings) === null;
}

/** After how many days an article without a last day is marked in the admin as having stood long. */
export const STANDING_LONG_DAYS = 14;

/**
 * How many days a published article with nothing that ends it has stood, when it is
 * STANDING_LONG_DAYS or more: such an article may be about something that is over. Null otherwise.
 */
export function daysStandingLong(article: Published & { publishedAt?: string }, gatherings: readonly Event[], now: number): number | null {
  if (!needsLastDay(article, gatherings)) return null;
  const published = Date.parse(article.publishedAt ?? "");
  if (Number.isNaN(published)) return null;
  const days = Math.floor((now - published) / 86_400_000);
  return days >= STANDING_LONG_DAYS ? days : null;
}
