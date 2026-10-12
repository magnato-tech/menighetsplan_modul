import type { CmsMedia, CmsNewsArticle, CmsPage, CmsSettings } from "../data/cmsData";
import type { Gathering } from "../types";
import { teaserOf } from "./gatheringPresentation";
import { isOpenCommunityGathering } from "./gatherings";
import { mediaMapFromList, resolveShareableMediaUrl } from "./media";
import { isPagePublished, pageUrl } from "./menu";
import { isPublicPath } from "./routes";

// What each address of the website tells search engines and sharing services: title,
// description and image. The browser and the server both ask here, so a link shared on
// social media shows the same as the tab in the browser does.

export interface PageSeoConfig {
  title?: string;
  /** The whole title as it should read. Without it, the title is "<title> – <church>". */
  fullTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  heroImage?: string;
  summary?: string;
  slug?: string;
  canonicalUrl?: string;
  churchName?: string;
  siteName?: string;
  type?: "website" | "article";
  /** No page lives at the address. Search engines are asked to leave it out. */
  notFound?: boolean;
}

/** A page's search and sharing details with every fallback applied. */
export interface ResolvedSeo {
  title: string;
  description: string;
  /** Always a complete address */
  image: string;
  url: string;
  siteName: string;
  type: "website" | "article";
  notFound: boolean;
}

const DEFAULT_CHURCH_NAME = "Menigheten";
const DEFAULT_SITE_TITLE = "Menighetsplan";
const DEFAULT_DESCRIPTION =
  "Enkel og varm handlingsportal for frivillige i menigheten til å se, ta og håndtere oppgaver.";

/**
 * The image as an address a sharing service can fetch, or undefined when it has none.
 * An uploaded image is stored as text in the page (a data URL) and cannot be fetched by anyone else.
 */
export function shareableImageUrl(image: string | undefined, origin: string): string | undefined {
  const trimmed = image?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return `${origin}${trimmed}`;
  return undefined;
}

/** Fills in what the page has not said itself: the summary for a missing description, the hero image for a missing share image. */
export function resolvePageSeo(
  config: PageSeoConfig,
  origin: string,
  pathname: string,
  media: CmsMedia[] = []
): ResolvedSeo {
  const churchName = config.churchName || DEFAULT_CHURCH_NAME;
  const siteName = config.siteName || DEFAULT_SITE_TITLE;
  const mediaById = mediaMapFromList(media);

  const title = config.fullTitle || `${config.title || siteName} – ${churchName}`;
  const description =
    config.metaDescription?.trim() ||
    config.summary?.trim() ||
    (config.title ? `Velkommen til ${config.title} i ${churchName}.` : DEFAULT_DESCRIPTION);

  const shareImage =
    resolveShareableMediaUrl(config.ogImage, mediaById) ||
    shareableImageUrl(config.ogImage, origin) ||
    resolveShareableMediaUrl(config.heroImage, mediaById) ||
    shareableImageUrl(config.heroImage, origin);

  return {
    title,
    description,
    image: shareImage || `${origin}/icon.svg`,
    url: config.canonicalUrl || `${origin}${pathname}`,
    siteName: churchName,
    type: config.type || "website",
    notFound: config.notFound === true,
  };
}

/** The content the website is built from, as far as titles and descriptions go. */
export interface SiteContent {
  pages: CmsPage[];
  news: CmsNewsArticle[];
  media: CmsMedia[];
  settings: Pick<CmsSettings, "churchName" | "appName" | "tagline" | "welcomeSubtext">;
  /** The events, for the pages they each have. Left out where no event page is asked about. */
  gatherings?: Gathering[];
}

// The built-in pages, for when no CMS page points at them
const CALENDAR = { title: "Hva skjer", describe: (church: string) => `Gudstjenester og arrangementer i ${church}.` };
const SERMONS = { title: "Taler", describe: (church: string) => `Taler og prekener fra ${church}.` };
const GROUPS = { title: "Fellesskap", describe: (church: string) => `Grupper og fellesskap i ${church}.` };
const LEADERSHIP = { title: "Lederskap", describe: (church: string) => `Stab og lederskap i ${church}.` };

const BUILT_IN_PAGES: Record<string, { title: string; describe: (church: string) => string }> = {
  "/hva-skjer": CALENDAR,
  "/kalender": CALENDAR,
  "/taler": SERMONS,
  "/fellesskap": GROUPS,
  "/grupper": GROUPS,
  "/lederskap": LEADERSHIP,
  "/stab": LEADERSHIP,
};

const sameSlug = (a: string, b: string) => a.replace(/^\//, "").toLowerCase() === b.replace(/^\//, "").toLowerCase();

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The search and sharing details of the address, or null when the address is not part of
 * the website (Min side, admin, the API). An address no published page answers to is
 * marked as not found; a draft or a page scheduled for later counts as not there yet.
 */
export function seoForPath(pathname: string, site: SiteContent, now: Date = new Date()): PageSeoConfig | null {
  if (!isPublicPath(pathname)) return null;

  const { settings } = site;
  const base = { churchName: settings.churchName, siteName: settings.appName };
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const published = site.pages.filter((page) => isPagePublished(page, now));

  if (path === "/" || path === "/nettside") {
    // The front page speaks for the whole church, so its title is the church's name
    const frontPage = published.find((page) => pageUrl(page) === "/");
    return {
      ...base,
      fullTitle: settings.tagline ? `${settings.churchName} – ${settings.tagline}` : settings.churchName,
      metaDescription: frontPage?.metaDescription,
      summary: settings.welcomeSubtext,
      ogImage: frontPage?.ogImage,
      heroImage: frontPage?.heroImage,
    };
  }

  const article = /^\/artikkel\/([^/]+)$/.exec(path);
  if (article) {
    const key = decoded(article[1]);
    const found = site.news.find((item) => item.id === key || item.slug.toLowerCase() === key.toLowerCase());
    return found && found.isPublished !== false
      ? { ...base, title: found.title, summary: found.summary, ogImage: found.imageUrl, type: "article" }
      : { ...base, title: "Artikkelen ble ikke funnet", notFound: true };
  }

  // An event's own page. Only an event open to everyone has one
  const eventPage = /^\/arrangement\/([^/]+)$/.exec(path);
  if (eventPage) {
    const id = decoded(eventPage[1]);
    const found = site.gatherings?.find((gathering) => gathering.id === id);
    return found && isOpenCommunityGathering(found)
      ? { ...base, title: found.title, summary: teaserOf(found), ogImage: found.imageUrl, type: "article" }
      : { ...base, title: "Arrangementet ble ikke funnet", notFound: true };
  }

  // A CMS page, at its own address or at the built-in page its menu entry points to
  const slug = /^\/(?:side\/|nettside\/)?([^/]+)$/.exec(path);
  const page =
    published.find((candidate) => pageUrl(candidate) === path) ??
    (slug ? published.find((candidate) => sameSlug(candidate.slug, decoded(slug[1]))) : undefined);
  if (page) {
    return {
      ...base,
      title: page.title,
      metaDescription: page.metaDescription,
      summary: page.summary,
      ogImage: page.ogImage,
      heroImage: page.heroImage,
      slug: page.slug,
    };
  }

  const builtIn = BUILT_IN_PAGES[path];
  if (builtIn) return { ...base, title: builtIn.title, summary: builtIn.describe(settings.churchName) };

  return { ...base, title: "Siden ble ikke funnet", notFound: true };
}
