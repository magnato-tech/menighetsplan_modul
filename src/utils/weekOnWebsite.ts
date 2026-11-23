import type { CmsNewsArticle } from "../data/cmsData";
import type { Gathering } from "../types";
import { isOpenCommunityGathering } from "./gatherings";
import { missingOnWebsite, type MissingOnWebsite } from "./gatheringPresentation";
import { lastDayOf } from "./news";

// «Denne uka på nettsiden»: what the week on the website holds, for the overview of the website.
// Days are counted in local time, as the admin shows them.

const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];
const DAYS_SHORT = ["søn.", "man.", "tir.", "ons.", "tor.", "fre.", "lør."];

export interface WeekSpan {
  /** Monday 00:00, local time. */
  start: number;
  /** Sunday 23:59:59.999, local time. */
  end: number;
  /** «mandag 23. – søndag 29. november», or with two months «mandag 30. november – søndag 6. desember». */
  label: string;
}

/** The Monday-to-Sunday week that contains `now`. */
export function weekOf(now: number): WeekSpan {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const offset = (date.getDay() + 6) % 7; // Monday is 0
  const monday = new Date(year, month, day - offset);
  const sunday = new Date(year, month, day - offset + 6);
  const nextMonday = new Date(year, month, day - offset + 7).getTime();

  const mondayText = `mandag ${monday.getDate()}.${monday.getMonth() === sunday.getMonth() ? "" : ` ${MONTHS[monday.getMonth()]}`}`;
  const sundayText = `søndag ${sunday.getDate()}. ${MONTHS[sunday.getMonth()]}`;
  return { start: monday.getTime(), end: nextMonday - 1, label: `${mondayText} – ${sundayText}` };
}

/** A day as the rows show it: «man. 23. nov.». */
export function shortDate(moment: number): string {
  const date = new Date(moment);
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]}`;
}

/** A moment as the rows show it: «tor. 26. nov. kl. 09:00». */
export function shortDateTime(moment: number): string {
  const date = new Date(moment);
  return `${shortDate(moment)} kl. ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** A day given as «2026-12-04» (the day the calendar shows), as the rows show it: «fre. 4. des.». */
export function shortDateOfDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return shortDate(new Date(year, month - 1, date, 12).getTime());
}

/** A local day as «2026-12-04». */
const dayString = (moment: number): string => {
  const date = new Date(moment);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export interface WeekGathering {
  gathering: Gathering;
  /** The start, in milliseconds. */
  start: number;
  /** What the event lacks on the website. Empty when it is ready. */
  missing: MissingOnWebsite[];
}

/**
 * The public events from now until the end of the week, in start order, with what each lacks on the
 * website. Ready events are included (nothing missing). Cancelled events and internal ones are left out,
 * and so are group gatherings, as the site check leaves them out.
 */
export function missingThisWeek(gatherings: readonly Gathering[], now: number): WeekGathering[] {
  const { end } = weekOf(now);
  const items: WeekGathering[] = [];
  for (const gathering of gatherings) {
    if (gathering.cancelled || !isOpenCommunityGathering(gathering)) continue;
    const start = Date.parse(gathering.startsAt);
    if (Number.isNaN(start) || start < now || start > end) continue;
    items.push({ gathering, start, missing: missingOnWebsite(gathering) });
  }
  return items.sort((a, b) => a.start - b.start);
}

export interface NewsPublishing {
  news: CmsNewsArticle;
  /** When it is published, in milliseconds. Later than now. */
  at: number;
}

export interface NewsExpiring {
  news: CmsNewsArticle;
  /** The last day it is shown, «2026-12-04». */
  day: string;
}

/**
 * The published news this week: the articles that are published later this week, and the ones whose
 * last day falls within this week, today included.
 */
export function newsThisWeek(
  news: readonly CmsNewsArticle[],
  gatherings: readonly Pick<Gathering, "id" | "startsAt" | "endsAt">[],
  now: number
): { publishing: NewsPublishing[]; expiring: NewsExpiring[] } {
  const week = weekOf(now);
  const monday = dayString(week.start);
  const sunday = dayString(week.end);
  const published = news.filter((article) => article.isPublished !== false);

  const publishing = published
    .flatMap((article) => {
      const at = Date.parse(article.publishedAt ?? "");
      return !Number.isNaN(at) && at > now && at <= week.end ? [{ news: article, at }] : [];
    })
    .sort((a, b) => a.at - b.at);

  const expiring = published
    .flatMap((article) => {
      const last = lastDayOf(article, gatherings);
      return last && last.day >= monday && last.day <= sunday ? [{ news: article, day: last.day }] : [];
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  return { publishing, expiring };
}

export interface RecentChange {
  kind: "side" | "nyhet";
  title: string;
  updatedAt: string;
  updatedBy?: string;
}

/** The pages and news saved most recently, newest first. Items without a valid save time are left out. */
export function recentChanges(
  pages: readonly { title: string; updatedAt?: string; updatedBy?: string }[],
  news: readonly { title: string; updatedAt?: string; updatedBy?: string }[],
  _now: number,
  limit = 5
): RecentChange[] {
  const changes: (RecentChange & { time: number })[] = [];
  const add = (kind: RecentChange["kind"], item: { title: string; updatedAt?: string; updatedBy?: string }) => {
    const time = Date.parse(item.updatedAt ?? "");
    if (Number.isNaN(time)) return;
    changes.push({ kind, title: item.title, updatedAt: item.updatedAt ?? "", updatedBy: item.updatedBy, time });
  };
  pages.forEach((page) => add("side", page));
  news.forEach((article) => add("nyhet", article));
  return changes
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ kind, title, updatedAt, updatedBy }) => ({ kind, title, updatedAt, updatedBy }));
}
