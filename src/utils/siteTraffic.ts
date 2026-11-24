import type { CmsSermon, CmsSettings } from "../data/cmsData";
import { isAddonOn, type AddonChoices } from "./addons";
import type { Change } from "./analyticsFormat";
import { isPagePublished, pageUrl } from "./menu";
import { isPublicPath } from "./routes";
import { seoForPath, type SiteContent } from "./siteSeo";

// Visits to the public website, counted without knowing who the visitor is.
//
// The website itself says which page it shows, when, for how long, and which of its own
// buttons are pressed. That is all. Nothing is stored in the visitor's browser, nothing about
// the visitor or the device is kept, and only sums per day are stored. (The browser's name is
// looked at where the page runs, to tell a robot from a person, and goes no further.) A visit
// is therefore one opening of the website, not one person: the same person coming back in the
// evening is a new visit, and "new and returning visitors" cannot be told apart. That would
// take remembering the browser, which the law (ekomloven § 3-15) only allows with the
// visitor's consent.
//
// One document per day holds the sums (see services/siteTraffic.ts for where it is stored).
// This file is the rules and the arithmetic: which address a count belongs to, which day and
// hour it falls on, and how the days add up to what the board shows.

// ---------- The day as stored ----------

export const TRAFFIC_RECORD = "siteTraffic";

/**
 * Whether the website counts its visits. It does only while the add-on «Besøk på nettsiden» is
 * on (see utils/addons.ts), and not while the congregation has paused the counting on the board.
 */
export type VisitCounting = "counted" | "paused" | "off";

export const visitCounting = (addons: AddonChoices | undefined, settings: Pick<CmsSettings, "countVisits">): VisitCounting =>
  !isAddonOn(addons, "nettsidebesok") ? "off" : settings.countVisits === false ? "paused" : "counted";
export const TRAFFIC_DOC_PREFIX = "traffic-";
export const trafficDocId = (date: string): string => `${TRAFFIC_DOC_PREFIX}${date}`;

type Counts = Record<string, number>;

/** The sums of one day, Norwegian time. Every map is keyed by what was counted. */
export interface TrafficDay {
  /** "2026-10-07" */
  date: string;
  /** Times the website was opened. */
  visits: number;
  /** Visits that went on to a second page. */
  deepVisits: number;
  /** Page views per address. */
  views: Counts;
  /** Visits that started at the address. */
  entries: Counts;
  /** Seconds the address was in view, summed. */
  seconds: Counts;
  /** Page views per hour of the day, "0" to "23". */
  hours: Counts;
  /** Presses per action (see TRAFFIC_ACTIONS). */
  actions: Counts;
  /** Plays per sermon id. */
  sermons: Counts;
  /** Hits per address that no page answers to. */
  missing: Counts;
  /** Example numbers made for a demonstration, not counted visits. */
  simulated?: boolean;
}

export const emptyTrafficDay = (date: string): TrafficDay => ({
  date,
  visits: 0,
  deepVisits: 0,
  views: {},
  entries: {},
  seconds: {},
  hours: {},
  actions: {},
  sermons: {},
  missing: {},
});

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
const counts = (value: unknown): Counts => {
  const result: Counts = {};
  if (!value || typeof value !== "object") return result;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (count(raw) > 0) result[key] = count(raw);
  }
  return result;
};

/** A stored document as a day, or null when it is not one. Anything that is not a count is left out. */
export function parseTrafficDay(data: Record<string, unknown> | undefined): TrafficDay | null {
  if (!data || data.recordType !== TRAFFIC_RECORD || typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    return null;
  }
  return {
    date: data.date,
    visits: count(data.visits),
    deepVisits: count(data.deepVisits),
    views: counts(data.views),
    entries: counts(data.entries),
    seconds: counts(data.seconds),
    hours: counts(data.hours),
    actions: counts(data.actions),
    sermons: counts(data.sermons),
    missing: counts(data.missing),
    ...(data.simulated === true ? { simulated: true } : {}),
  };
}

// ---------- What the visitor can do that is counted ----------

export const TRAFFIC_ACTIONS = [
  { id: "kontakt-telefon", label: "Trykk på telefonnummer" },
  { id: "kontakt-epost", label: "Trykk på e-postadresse" },
  { id: "kalender-abonner", label: "Abonner på kalenderen" },
  { id: "tale-avspilt", label: "Avspilte taler" },
] as const;

export type TrafficActionId = (typeof TRAFFIC_ACTIONS)[number]["id"];

/** The action a link stands for, read from where it leads. Null for every other link. */
export function trafficActionForLink(href: string | null | undefined): TrafficActionId | null {
  const target = (href ?? "").trim().toLowerCase();
  if (target.startsWith("tel:")) return "kontakt-telefon";
  if (target.startsWith("mailto:")) return "kontakt-epost";
  if (target.startsWith("webcal:") || /\.ics(?:$|[?#])/.test(target)) return "kalender-abonner";
  return null;
}

// ---------- Sign-ins and openings of Min side ----------

// Counted in the same day documents, under `actions`, but not website actions: they are shown on
// the Innlogging tab, never in Nettsidebesøk (see TRAFFIC_ACTIONS and hasAnyCount). Only sums.

/** The ways of signing in to Min side that are counted. */
export const LOGIN_COUNTS = [
  { id: "innlogging-google", label: "Google" },
  { id: "innlogging-epostlenke", label: "E-postlenke" },
  { id: "innlogging-lenke", label: "Lenke fra e-post" },
] as const;

export type LoginCountId = (typeof LOGIN_COUNTS)[number]["id"];

/** Openings of Min side, counted once per browser per day (see hooks/useMinSideOpenCount.ts). */
export const MIN_SIDE_OPENED = "minside-aapnet";

// ---------- Which address a count belongs to ----------

const MAX_ADDRESS_LENGTH = 120;

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * The address a page view is counted under. One page has one address here, however it was
 * typed: "/Om-oss/", "/side/om-oss" and "/nettside/om-oss" are all "/om-oss". The id of an
 * article is kept as written, since ids tell capitals apart.
 */
export function trafficAddress(pathname: string): string {
  const path = decoded(pathname.split(/[?#]/)[0] || "/")
    .replace(/\/{2,}/g, "/")
    .replace(/(.)\/+$/, "$1");
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  const first = segments[0].toLowerCase();
  if ((first === "side" || first === "nettside") && segments.length <= 2) {
    return segments.length === 1 && first === "nettside" ? "/" : `/${(segments[1] ?? first).toLowerCase()}`;
  }
  const address = first === "artikkel" && segments.length === 2 ? `/artikkel/${segments[1]}` : `/${segments.join("/").toLowerCase()}`;
  return address.slice(0, MAX_ADDRESS_LENGTH);
}

/** What showing an address is counted as: a view of a page, a hit on an address with no page, or nothing. */
export type TrafficTarget = { kind: "page" | "missing"; address: string } | null;

/**
 * Whether the address is a page of the website. Min side, admin and the API are not counted at
 * all. The same rule decides here as for titles and search engines (seoForPath), so the board
 * and the website never disagree on what is a page.
 */
export function trafficTarget(pathname: string, site: SiteContent, now: Date = new Date()): TrafficTarget {
  if (!isPublicPath(pathname)) return null;
  const address = trafficAddress(pathname);
  const seo = seoForPath(address, site, now);
  if (!seo) return null;
  if (seo.notFound) return { kind: "missing", address };
  // An article answers to its id and to the name in its address. Both are counted on the id.
  const key = /^\/artikkel\/([^/]+)$/.exec(address)?.[1];
  const article = key ? site.news.find((item) => item.id === key || item.slug.toLowerCase() === key.toLowerCase()) : undefined;
  return { kind: "page", address: article ? `/artikkel/${article.id}` : address };
}

// ---------- Days and hours, Norwegian time ----------

const OSLO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** The day and the hour a moment falls on in Norway, wherever the visitor's clock is set. */
export function osloDayAndHour(at: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(OSLO.formatToParts(at).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

const utc = (date: string): number => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};
const DAY_MS = 24 * 60 * 60 * 1000;

/** The date a number of days after (or, negative, before) another. */
export const addDays = (date: string, days: number): string => new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10);

/** Monday is 0, Sunday is 6. */
export const weekdayOf = (date: string): number => (new Date(utc(date)).getUTCDay() + 6) % 7;

export const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"] as const;

/** "7.10." for a column label. */
export const formatTrafficDate = (date: string): string => {
  const [, month, day] = date.split("-").map(Number);
  return `${day}.${month}.`;
};

// ---------- The period ----------

export type TrafficPeriodId = "7d" | "4w" | "3m" | "12m";

export const TRAFFIC_PERIODS: { id: TrafficPeriodId; label: string; previousLabel: string; days: number }[] = [
  { id: "7d", label: "Siste 7 dager", previousLabel: "forrige 7 dager", days: 7 },
  { id: "4w", label: "Siste 4 uker", previousLabel: "forrige 4 uker", days: 28 },
  { id: "3m", label: "Siste 3 måneder", previousLabel: "forrige 3 måneder", days: 91 },
  // 52 whole weeks, so both periods hold the same number of Sundays
  { id: "12m", label: "Siste 12 måneder", previousLabel: "forrige 12 måneder", days: 364 },
];

export const DEFAULT_TRAFFIC_PERIOD: TrafficPeriodId = "4w";

export interface TrafficPeriod {
  id: TrafficPeriodId;
  label: string;
  previousLabel: string;
  days: number;
  /** The period is the days from `from` up to and including `to`, which is today. */
  from: string;
  to: string;
  /** The period before it, as long. */
  previousFrom: string;
  previousTo: string;
}

export function trafficPeriod(id: TrafficPeriodId, now: Date): TrafficPeriod {
  const spec = TRAFFIC_PERIODS.find((period) => period.id === id) ?? TRAFFIC_PERIODS[1];
  const to = osloDayAndHour(now).date;
  const from = addDays(to, -(spec.days - 1));
  return { ...spec, from, to, previousFrom: addDays(from, -spec.days), previousTo: addDays(from, -1) };
}

// ---------- What the board shows ----------

export interface TrafficTotals {
  visits: number;
  views: number;
  /** Null when there were no visits to divide by. */
  pagesPerVisit: number | null;
  secondsPerVisit: number | null;
  /** The share of visits that saw one page only. */
  singlePageShare: number | null;
}

export interface TrafficColumn {
  /** The first and last day the column covers. */
  from: string;
  to: string;
  label: string;
  visits: number;
  views: number;
}

export interface TrafficPageRow {
  address: string;
  title: string;
  /** False when no page answers to the address any more. */
  exists: boolean;
  views: number;
  /** This page's share of all page views. */
  share: number;
  entries: number;
  /** The seconds the page was in view, divided by its views. Null when no time was measured. */
  secondsPerView: number | null;
}

export interface TrafficSummary {
  period: TrafficPeriod;
  /** Whether anything at all was counted in the period. */
  hasCounts: boolean;
  /** How many of the period's days have counts, and the first day there are counts from. */
  daysWithCounts: number;
  countingSince: string | null;
  /** Whether the period holds example numbers made for a demonstration. */
  hasExamples: boolean;
  totals: TrafficTotals;
  /** The period before. Null when nothing was counted then, so nothing is compared with it. */
  previous: TrafficTotals | null;
  columns: TrafficColumn[];
  /** What one column covers: "dag", "uke" or "fire uker". */
  columnUnit: "dag" | "uke" | "fire uker";
  /** Every page that was opened, most opened first. */
  pages: TrafficPageRow[];
  /** Published pages nobody opened in the period. */
  neverOpened: { address: string; title: string }[];
  /** Where visits started, most used first. */
  entryPages: { address: string; title: string; entries: number; share: number }[];
  /** Addresses that were asked for but have no page. */
  missing: { address: string; hits: number }[];
  /** Page views per weekday (Monday first) and hour: rhythm[weekday][hour]. */
  rhythm: number[][];
  weekdays: { label: string; views: number }[];
  /** The weekday and hour with most page views. */
  busiest: { weekday: string; hour: number; views: number } | null;
  actions: { id: TrafficActionId; label: string; count: number; previous: number | null }[];
  /** Articles opened, most opened first. */
  news: { address: string; title: string; views: number }[];
  /** Sermons played, most played first. */
  sermons: { id: string; title: string; plays: number }[];
}

export interface TrafficSite extends SiteContent {
  sermons: Pick<CmsSermon, "id" | "title">[];
}

const sumOf = (values: Counts): number => Object.values(values).reduce((sum, value) => sum + value, 0);
const addInto = (target: Counts, source: Counts): void => {
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + value;
};

function totalsOf(days: TrafficDay[]): TrafficTotals {
  const visits = days.reduce((sum, day) => sum + day.visits, 0);
  const deepVisits = days.reduce((sum, day) => sum + day.deepVisits, 0);
  const views = days.reduce((sum, day) => sum + sumOf(day.views), 0);
  const seconds = days.reduce((sum, day) => sum + sumOf(day.seconds), 0);
  return {
    visits,
    views,
    pagesPerVisit: visits > 0 ? views / visits : null,
    secondsPerVisit: visits > 0 && seconds > 0 ? seconds / visits : null,
    // More second pages than visits can only come from a count that went missing; never show a negative share
    singlePageShare: visits > 0 ? Math.max(0, visits - deepVisits) / visits : null,
  };
}

// Only the website's own actions count here: a day with just the sign-in counts is no day of website traffic
const hasAnyCount = (day: TrafficDay): boolean =>
  day.visits > 0 ||
  [day.views, day.sermons, day.missing].some((values) => sumOf(values) > 0) ||
  TRAFFIC_ACTIONS.some((action) => (day.actions[action.id] ?? 0) > 0);

function describeAddress(address: string, site: SiteContent, now: Date): { title: string; exists: boolean } {
  if (address === "/") return { title: "Forsiden", exists: true };
  const seo = seoForPath(address, site, now);
  if (!seo || seo.notFound) return { title: address, exists: false };
  return { title: seo.title ?? address, exists: true };
}

/** The columns of the chart: a day each for up to four weeks, then a week each, then four weeks each. */
function columnsOf(period: TrafficPeriod, byDate: Map<string, TrafficDay>): { columns: TrafficColumn[]; unit: TrafficSummary["columnUnit"] } {
  const span = period.days <= 28 ? 1 : period.days <= 91 ? 7 : 28;
  const columns: TrafficColumn[] = [];
  for (let offset = 0; offset < period.days; offset += span) {
    const from = addDays(period.from, offset);
    const column: TrafficColumn = { from, to: addDays(from, span - 1), label: formatTrafficDate(from), visits: 0, views: 0 };
    for (let day = 0; day < span; day++) {
      const counted = byDate.get(addDays(from, day));
      if (!counted) continue;
      column.visits += counted.visits;
      column.views += sumOf(counted.views);
    }
    columns.push(column);
  }
  return { columns, unit: span === 1 ? "dag" : span === 7 ? "uke" : "fire uker" };
}

/**
 * Everything the board shows for a period, from the days counted. `days` may hold more days
 * than the period and the one before it; the rest is ignored.
 */
export function summarizeTraffic(days: TrafficDay[], site: TrafficSite, periodId: TrafficPeriodId, now: Date): TrafficSummary {
  const period = trafficPeriod(periodId, now);
  const within = (from: string, to: string) => days.filter((day) => day.date >= from && day.date <= to);
  const current = within(period.from, period.to);
  const before = within(period.previousFrom, period.previousTo);
  const counted = current.filter(hasAnyCount);
  const countedBefore = before.filter(hasAnyCount);
  const byDate = new Map(current.map((day) => [day.date, day]));

  const views: Counts = {};
  const entries: Counts = {};
  const seconds: Counts = {};
  const missing: Counts = {};
  const sermonPlays: Counts = {};
  const actionCounts: Counts = {};
  const actionCountsBefore: Counts = {};
  const rhythm = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const day of current) {
    addInto(views, day.views);
    addInto(entries, day.entries);
    addInto(seconds, day.seconds);
    addInto(missing, day.missing);
    addInto(sermonPlays, day.sermons);
    addInto(actionCounts, day.actions);
    const weekday = weekdayOf(day.date);
    for (const [hour, value] of Object.entries(day.hours)) {
      const index = Number(hour);
      if (Number.isInteger(index) && index >= 0 && index < 24) rhythm[weekday][index] += value;
    }
  }
  for (const day of before) addInto(actionCountsBefore, day.actions);

  const totals = totalsOf(current);
  const allEntries = sumOf(entries);
  const pages: TrafficPageRow[] = Object.entries(views)
    .map(([address, pageViews]) => ({
      address,
      ...describeAddress(address, site, now),
      views: pageViews,
      share: totals.views > 0 ? pageViews / totals.views : 0,
      entries: entries[address] ?? 0,
      // Every view counts, also the ones too short to leave any seconds behind. Leaving them out
      // would make a page that most visitors leave at once look like one they stay on.
      secondsPerView: seconds[address] > 0 ? seconds[address] / pageViews : null,
    }))
    .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title, "nb"));

  // A page that only sends the visitor on to another address has no views of its own to miss.
  // Two pages that share an address are one row: it is the address that is opened, or never is.
  const unopened = new Map<string, { address: string; title: string }>();
  for (const page of site.pages) {
    if (!isPagePublished(page, now) || page.linkUrl) continue;
    const address = trafficAddress(pageUrl(page));
    if (!views[address] && !unopened.has(address)) unopened.set(address, { address, title: page.title });
  }
  const neverOpened = [...unopened.values()].sort((a, b) => a.title.localeCompare(b.title, "nb"));

  let busiest: TrafficSummary["busiest"] = null;
  rhythm.forEach((hours, weekday) =>
    hours.forEach((value, hour) => {
      if (value > (busiest?.views ?? 0)) busiest = { weekday: WEEKDAY_LABELS[weekday], hour, views: value };
    })
  );

  const sermonTitles = new Map(site.sermons.map((sermon) => [sermon.id, sermon.title]));
  const { columns, unit } = columnsOf(period, byDate);

  return {
    period,
    hasCounts: counted.length > 0,
    daysWithCounts: counted.length,
    countingSince: [...counted, ...countedBefore].reduce<string | null>((first, day) => (!first || day.date < first ? day.date : first), null),
    hasExamples: [...current, ...before].some((day) => day.simulated),
    totals,
    previous: countedBefore.length > 0 ? totalsOf(before) : null,
    columns,
    columnUnit: unit,
    pages,
    neverOpened,
    entryPages: pages
      .filter((page) => page.entries > 0)
      .map((page) => ({ address: page.address, title: page.title, entries: page.entries, share: allEntries > 0 ? page.entries / allEntries : 0 }))
      .sort((a, b) => b.entries - a.entries || a.title.localeCompare(b.title, "nb")),
    missing: Object.entries(missing)
      .map(([address, hits]) => ({ address, hits }))
      .sort((a, b) => b.hits - a.hits || a.address.localeCompare(b.address, "nb")),
    rhythm,
    weekdays: rhythm.map((hours, weekday) => ({ label: WEEKDAY_LABELS[weekday], views: hours.reduce((sum, value) => sum + value, 0) })),
    busiest,
    actions: TRAFFIC_ACTIONS.map((action) => ({
      ...action,
      count: actionCounts[action.id] ?? 0,
      previous: countedBefore.length > 0 ? (actionCountsBefore[action.id] ?? 0) : null,
    })),
    news: pages.filter((page) => page.address.startsWith("/artikkel/") && page.exists).map(({ address, title, views: opened }) => ({ address, title, views: opened })),
    sermons: Object.entries(sermonPlays)
      .map(([id, plays]) => ({ id, title: sermonTitles.get(id) ?? "En tale som ikke finnes lenger", plays }))
      .sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title, "nb")),
  };
}

// ---------- How the board writes its numbers ----------

/** "45 sek" under a minute, "2 min 5 sek" above. A dash when there is nothing to show. */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "–";
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole} sek`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sek`;
}

/** "1 sidevisning", "3 sidevisninger": a number with its noun in the form the number calls for. */
export const countOf = (value: number, one: string, many: string): string =>
  `${value.toLocaleString("nb-NO")} ${value === 1 ? one : many}`;

/** "2,4" for pages per visit. */
export const formatPerVisit = (value: number | null): string =>
  value === null ? "–" : value.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "kl. 10–11" for the hour that starts at 10. */
export const formatHourSpan = (hour: number): string => `kl. ${hour}–${hour + 1}`;

/**
 * How a number with a decimal moved since the period before: "+0,3". Null when either side is
 * missing, so the board never claims a rise from nothing (see describeChange for whole numbers).
 */
export function describeDecimalChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { direction: "flat", text: "Uendret" };
  const size = Math.abs(diff).toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { direction: diff > 0 ? "up" : "down", text: `${diff > 0 ? "+" : "−"}${size}` };
}

/** How a time moved since the period before: "+12 sek". */
export function describeSecondsChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) return { direction: "flat", text: "Uendret" };
  return { direction: diff > 0 ? "up" : "down", text: `${diff > 0 ? "+" : "−"}${formatSeconds(Math.abs(diff))}` };
}
