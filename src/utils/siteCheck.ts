import type { CmsMedia, CmsNewsArticle, CmsPage } from "../data/cmsData";
import type { Gathering } from "../types";
import type { StudioTab } from "../pages/admin/studio";
import { parseContentToVisualBlocks, readStaticFields } from "./cmsBlocks";
import { buildLinkContext, findBrokenLinksOnPage } from "./cmsLinks";
import { missingOnWebsite } from "./gatheringPresentation";
import { parseMediaId } from "./media";
import { isPagePublished } from "./menu";
import { daysStandingLong } from "./news";

// «Sjekk nettsiden»: what is missing or wrong across the website, in one list, as the SEO checklist in
// Wix and the Audit panel in Webflow do. Each finding says where it is and which tab mends it.

export type SiteCheckKind = "brokenLink" | "noDescription" | "imageWithoutAlt" | "newsStanding" | "eventMissing";

export interface SiteCheckFinding {
  kind: SiteCheckKind;
  /** What it is about: the page, the article or the event. */
  where: string;
  /** What is wrong, in a few words. */
  what: string;
  /** The tab where it is mended. */
  tab: StudioTab;
  /** A stable name for the finding, used to put it aside («Ikke nå»). Stays the same between checks. */
  key: string;
  /** For an event: the events it is about, in date order (one, or every upcoming event of a series). */
  gatheringIds?: string[];
  /** For a series finding: the series the events belong to. */
  seriesId?: string;
}

const EVENT_DAY = new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Oslo" });
const EVENT_DATE = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "Europe/Oslo" });

/** How many dates are written out for a series before «…». */
const DATES_SHOWN = 4;

/** How far ahead events are looked at: the ones visitors are about to see. */
const EVENTS_AHEAD_MS = 8 * 7 * 86_400_000;

export interface SiteCheckInput {
  pages: CmsPage[];
  news: CmsNewsArticle[];
  gatherings: Gathering[];
  media: Pick<CmsMedia, "id" | "altText">[];
  now: number;
}

export function siteCheck({ pages, news, gatherings, media, now }: SiteCheckInput): SiteCheckFinding[] {
  const findings: SiteCheckFinding[] = [];
  const published = pages.filter((page) => isPagePublished(page, new Date(now)));
  const context = buildLinkContext(pages);
  const altOf = new Map(media.map((item) => [item.id, item.altText?.trim() || ""]));

  for (const page of published) {
    if (findBrokenLinksOnPage(page, context).length > 0) {
      findings.push({ kind: "brokenLink", where: page.title, what: "Lenke til en side som ikke finnes", tab: "cms-sider", key: `brokenLink:${page.id}` });
    }
    if (!page.metaDescription?.trim() && !page.summary?.trim() && !page.linkUrl) {
      findings.push({ kind: "noDescription", where: page.title, what: "Ingen beskrivelse for Google", tab: "cms-sider", key: `noDescription:${page.id}` });
    }
    const imagesWithoutAlt = parseContentToVisualBlocks(page.content || "").filter((block) => {
      if (block.hidden || (block.type !== "media-left" && block.type !== "media-right")) return false;
      const fields = readStaticFields(block);
      if (!fields.imageUrl.trim() || fields.imageAlt.trim()) return false;
      const mediaId = parseMediaId(fields.imageUrl);
      return !(mediaId && altOf.get(mediaId));
    }).length;
    if (imagesWithoutAlt > 0) {
      findings.push({
        kind: "imageWithoutAlt",
        where: page.title,
        what: imagesWithoutAlt === 1 ? "Et bilde uten beskrivelse for skjermleser" : `${imagesWithoutAlt} bilder uten beskrivelse for skjermleser`,
        tab: "cms-sider",
        key: `imageWithoutAlt:${page.id}`,
      });
    }
  }

  for (const article of news) {
    const days = daysStandingLong(article, gatherings, now);
    if (days !== null) {
      findings.push({ kind: "newsStanding", where: article.title, what: `Har stått i ${days} dager uten siste dag`, tab: "cms-nyheter", key: `newsStanding:${article.id}` });
    }
  }

  // The upcoming events that miss something on the website, with their start time
  const missingEvents: { gathering: Gathering; start: number; missing: string[] }[] = [];
  for (const gathering of gatherings) {
    const start = Date.parse(gathering.startsAt);
    if (Number.isNaN(start) || start < now || start > now + EVENTS_AHEAD_MS || gathering.cancelled) continue;
    const missing = missingOnWebsite(gathering);
    if (missing.length > 0) missingEvents.push({ gathering, start, missing });
  }

  // Two or more upcoming events of one series that miss something become one line, at the place of the first
  const seriesCount = new Map<string, number>();
  for (const { gathering } of missingEvents) {
    if (gathering.seriesId) seriesCount.set(gathering.seriesId, (seriesCount.get(gathering.seriesId) ?? 0) + 1);
  }
  const emittedSeries = new Set<string>();
  for (const { gathering, start, missing } of missingEvents) {
    const seriesId = gathering.seriesId;
    if (seriesId && (seriesCount.get(seriesId) ?? 0) >= 2) {
      if (emittedSeries.has(seriesId)) continue;
      emittedSeries.add(seriesId);
      const members = missingEvents
        .filter((item) => item.gathering.seriesId === seriesId)
        .sort((a, b) => a.start - b.start);
      const missingKinds = new Set<string>(members.flatMap((item) => item.missing));
      const phrase = ["bilde", "tekst"].filter((kind) => missingKinds.has(kind)).join(" og ");
      const dates = members.map((item) => EVENT_DATE.format(item.start));
      const shown = dates.slice(0, DATES_SHOWN).join(", ") + (dates.length > DATES_SHOWN ? ", …" : "");
      findings.push({
        kind: "eventMissing",
        where: gathering.title,
        what: `${members.length} kommende mangler ${phrase}: ${shown}`,
        tab: "cms-overstyringer",
        key: `eventMissing:series:${seriesId}`,
        gatheringIds: members.map((item) => item.gathering.id),
        seriesId,
      });
      continue;
    }
    findings.push({
      kind: "eventMissing",
      where: `${gathering.title} · ${EVENT_DAY.format(start)}`,
      what: `Mangler ${missing.join(" og ")} på nettsiden`,
      tab: "cms-overstyringer",
      key: `eventMissing:${gathering.id}`,
      gatheringIds: [gathering.id],
    });
  }

  return findings;
}
