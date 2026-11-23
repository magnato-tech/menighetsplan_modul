import type { CmsNewsArticle } from "../data/cmsData";
import type { Gathering } from "../types";
import { isNewsExpired, lastDayOf, norwegianDayOf } from "./news";

// The status of a news article in the admin list: what it is doing now, in one word for the pill.

/** Short Norwegian month names, as the admin writes them: «1. des.». */
const MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

/** Articles whose last day is this many days ahead or less are shown as «Går ut». */
const ENDING_SOON_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NewsStatus = {
  kind: "kladd" | "planlagt" | "gar-ut" | "gatt-ut" | "publisert";
  label: string;
};

/** A day ("2026-12-04") as «4. des.». */
const shortDay = (day: string): string => {
  const [, month, dayOfMonth] = day.split("-");
  return `${Number(dayOfMonth)}. ${MONTHS_SHORT[Number(month) - 1]}`;
};

/** The status of an article at a moment. Checked in order: draft, planned, ended, ending soon, otherwise published. */
export function newsStatusOf(
  article: Pick<CmsNewsArticle, "publishedAt" | "isPublished" | "expiresAt" | "gatheringRefId">,
  gatherings: readonly Gathering[],
  now: number
): NewsStatus {
  if (article.isPublished === false) return { kind: "kladd", label: "Kladd" };

  const published = Date.parse(article.publishedAt);
  if (!Number.isNaN(published) && published > now) {
    return { kind: "planlagt", label: `Planlagt ${shortDay(norwegianDayOf(published))}` };
  }

  if (isNewsExpired(article, gatherings, now)) return { kind: "gatt-ut", label: "Gått ut" };

  const last = lastDayOf(article, gatherings);
  if (last) {
    const daysLeft = Math.round((Date.parse(`${last.day}T12:00:00Z`) - Date.parse(`${norwegianDayOf(now)}T12:00:00Z`)) / DAY_MS);
    if (daysLeft <= ENDING_SOON_DAYS) return { kind: "gar-ut", label: `Går ut ${shortDay(last.day)}` };
  }

  return { kind: "publisert", label: "Publisert" };
}

export type NewsFilter = "alle" | "publisert" | "kladd" | "planlagt" | "gar-ut";

/** Which statuses each filter shows. «publisert» includes the ones about to end and the ended ones: they are published. */
const KINDS_IN_FILTER: Record<NewsFilter, readonly NewsStatus["kind"][] | null> = {
  alle: null,
  publisert: ["publisert", "gar-ut", "gatt-ut"],
  kladd: ["kladd"],
  planlagt: ["planlagt"],
  "gar-ut": ["gar-ut"],
};

/** The articles a filter shows, in the order they came. */
export function filterNews<T extends Pick<CmsNewsArticle, "publishedAt" | "isPublished" | "expiresAt" | "gatheringRefId">>(
  articles: readonly T[],
  filter: NewsFilter,
  gatherings: readonly Gathering[],
  now: number
): T[] {
  const kinds = KINDS_IN_FILTER[filter];
  if (kinds === null) return [...articles];
  return articles.filter((article) => kinds.includes(newsStatusOf(article, gatherings, now).kind));
}

/** How many articles each filter shows. */
export function countNewsByFilter<T extends Pick<CmsNewsArticle, "publishedAt" | "isPublished" | "expiresAt" | "gatheringRefId">>(
  articles: readonly T[],
  gatherings: readonly Gathering[],
  now: number
): Record<NewsFilter, number> {
  const counts = {} as Record<NewsFilter, number>;
  for (const filter of Object.keys(KINDS_IN_FILTER) as NewsFilter[]) {
    counts[filter] = filterNews(articles, filter, gatherings, now).length;
  }
  return counts;
}
