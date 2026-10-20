import type { CmsPage } from "../data/cmsData";
import { heroExtrasOf, heroHeightOf, heroMenuStyleOf, heroTitleFontOf, heroTitleSizeOf, heroTitleStyleOf, heroVeilOf } from "./heroLayout";

/**
 * The page as it is stored, built from what the editor holds. Every field the editor can change must
 * be named here: a field left out is lost on Lagre, while the preview (which reads the editor) still
 * shows it. `tests/page-record.test.ts` fails for a field of CmsPage that does not survive.
 */
/**
 * What the page in the editor would be stored as, leaving out the time of saving. Two pages with the
 * same fingerprint are saved alike, so the editor holds changes that are not saved when the fingerprint
 * differs from the one taken when the page was opened or last saved.
 */
export function pageFingerprint(pageData: Partial<CmsPage> & { id?: string }): string {
  const record = buildPageRecord(pageData, new Date(0), () => "");
  return JSON.stringify({ ...record, updatedAt: "" });
}

export function buildPageRecord(
  pageData: Partial<CmsPage> & { id?: string },
  now: Date,
  makeId: () => string
): CmsPage {
  const resolvedParent =
    pageData.parentPageId !== undefined ? pageData.parentPageId : pageData.parentId || null;
  const resolvedOrder =
    typeof pageData.menuOrder === "number"
      ? pageData.menuOrder
      : typeof pageData.navOrder === "number"
      ? pageData.navOrder
      : 99;
  const isPublished = pageData.isPublished !== false;
  const publishAt = pageData.publishAt?.trim() || pageData.publishedAt?.trim() || undefined;
  const isFutureScheduled = Boolean(isPublished && publishAt && new Date(publishAt).getTime() > now.getTime());
  const status: CmsPage["status"] = !isPublished ? "draft" : isFutureScheduled ? "scheduled" : "published";

  return {
    id: pageData.id || makeId(),
    slug: (pageData.slug || `side-${now.getTime()}`).toLowerCase().trim().replace(/^\//, ""),
    title: pageData.title || "Uten tittel",
    summary: pageData.summary || "",
    content: pageData.content || "",
    isPublished,
    status,
    parentPageId: resolvedParent,
    parentId: resolvedParent, // dual compatibility alias
    menuOrder: resolvedOrder,
    navOrder: resolvedOrder, // dual compatibility alias
    inNavMenu: pageData.inNavMenu !== false,
    // Left out of the stored document when the page has no link of its own
    linkUrl: pageData.linkUrl || undefined,
    updatedAt: now.toISOString(),
    heroImage: pageData.heroImage || "",
    heroImageAlt: pageData.heroImageAlt?.trim() || undefined,
    heroImages: heroExtrasOf(pageData.heroImages, pageData.heroImageTitles).heroImages,
    heroImageTitles: heroExtrasOf(pageData.heroImages, pageData.heroImageTitles).heroImageTitles.map((title) => title.trim()),
    heroArrows: pageData.heroArrows === true,
    heroZoom: pageData.heroZoom !== false,
    heroMenuStyle: heroMenuStyleOf(pageData),
    // Kept in step for anything that still reads the older on/off choice
    heroMenuOverlay: heroMenuStyleOf(pageData) !== "white",
    heroVeil: heroVeilOf(pageData),
    heroHeight: heroHeightOf(pageData),
    heroTitleStyle: heroTitleStyleOf(pageData),
    // Left out until chosen, so the size keeps following the style
    heroTitleSize: pageData.heroTitleSize ? heroTitleSizeOf(pageData) : undefined,
    heroTitleFont: heroTitleFontOf(pageData),
    showHeroSubtext: pageData.showHeroSubtext !== false,
    heroTitle: pageData.heroTitle || "",
    heroCtaText: pageData.heroCtaText || "",
    heroCtaLink: pageData.heroCtaLink || "",
    heroCtaSecondaryText: pageData.heroCtaSecondaryText || "",
    heroCtaSecondaryLink: pageData.heroCtaSecondaryLink || "",
    showHeroPrimaryCta: pageData.showHeroPrimaryCta !== false,
    showHeroSecondaryCta: pageData.showHeroSecondaryCta !== false,
    showHero: true,
    metaDescription: pageData.metaDescription?.trim() || undefined,
    ogImage: pageData.ogImage?.trim() || undefined,
    publishAt,
    publishedAt: publishAt,
  };
}
