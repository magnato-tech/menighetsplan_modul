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
