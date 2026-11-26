import { isPagePublished } from "../menu";
import type { AnalyticsPeriod } from "./periods";
import type { ChurchData } from "./shared";
import { before, timeOf, within } from "./shared";

// ============================================================================
// The website
// ============================================================================

export interface ContentSummary {
  newsPublished: number;
  previousNewsPublished: number;
  sermons: number;
  previousSermons: number;
  sermonsWithRecording: number;
  pages: { published: number; scheduled: number; drafts: number };
}

export function summarizeContent(data: Pick<ChurchData, "pages" | "news" | "sermons">, period: AnalyticsPeriod): ContentSummary {
  const published = data.news.filter((n) => n.isPublished);
  const sermonsIn = (from: number, to: number, inclusiveEnd: boolean) =>
    data.sermons.filter((s) => (inclusiveEnd ? within : before)(timeOf(s.date), from, to));
  const sermons = sermonsIn(period.from, period.to, true);
  const now = new Date(period.now);
  const live = data.pages.filter((p) => isPagePublished(p, now));
  const drafts = data.pages.filter((p) => p.isPublished === false || p.status === "draft");
  return {
    newsPublished: published.filter((n) => within(timeOf(n.publishedAt), period.from, period.to)).length,
    previousNewsPublished: published.filter((n) => before(timeOf(n.publishedAt), period.previousFrom, period.from)).length,
    sermons: sermons.length,
    previousSermons: sermonsIn(period.previousFrom, period.from, false).length,
    sermonsWithRecording: sermons.filter((s) => s.audioUrl || s.videoUrl || s.spotifyUrl).length,
    pages: { published: live.length, scheduled: data.pages.length - live.length - drafts.length, drafts: drafts.length },
  };
}
