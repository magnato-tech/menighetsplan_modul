import type { CmsPage } from "../data/cmsData";

/** A top-level page with its sub-pages. The menu has exactly these two levels. */
export interface PageNode {
  page: CmsPage;
  children: CmsPage[];
}

/** Resolves parent ID with fallback between canonical parentPageId and legacy parentId. */
export function getParentId(page: CmsPage): string | null {
  if (page.parentPageId !== undefined) {
    return page.parentPageId;
  }
  return page.parentId ?? null;
}

/** Resolves menu order with fallback between canonical menuOrder and legacy navOrder. */
export function getMenuOrder(page: CmsPage): number {
  if (typeof page.menuOrder === "number") {
    return page.menuOrder;
  }
  if (typeof page.navOrder === "number") {
    return page.navOrder;
  }
  return 99;
}

export const byMenuOrder = (a: CmsPage, b: CmsPage) => getMenuOrder(a) - getMenuOrder(b);

/** Every top-level page in menu order, each with its sub-pages in menu order. */
export function buildPageTree(pages: CmsPage[]): PageNode[] {
  return pages
    .filter((p) => !getParentId(p))
    .sort(byMenuOrder)
    .map((page) => ({
      page,
      children: pages.filter((p) => getParentId(p) === page.id).sort(byMenuOrder),
    }));
}

/** Returns true if a page is currently published and not held back by a future scheduled publish date. */
export function isPagePublished(page: CmsPage, now = new Date()): boolean {
  if (page.isPublished === false || page.status === "draft") {
    return false;
  }
  const schedule = page.publishAt || page.publishedAt;
  if (schedule) {
    const scheduledTime = new Date(schedule).getTime();
    if (!isNaN(scheduledTime) && scheduledTime > now.getTime()) {
      return false;
    }
  }
  return true;
}

/** The tree visitors see: published pages that are marked for the menu and not scheduled in the future. */
export function buildPublicMenu(pages: CmsPage[] = [], now = new Date()): PageNode[] {
  return buildPageTree(
    (pages || []).filter((p) => isPagePublished(p, now) && p.inNavMenu !== false)
  );
}

/** Sub-pages that no menu reaches, because their parent is gone or is itself a sub-page. */
export function findOrphanPages(pages: CmsPage[]): CmsPage[] {
  const topLevelIds = new Set(pages.filter((p) => !getParentId(p)).map((p) => p.id));
  return pages.filter((p) => {
    const pId = getParentId(p);
    return Boolean(pId && !topLevelIds.has(pId));
  });
}

/**
 * The pages left when one is deleted. Its sub-pages move to the top level,
 * since a sub-page pointing at a deleted page drops out of every menu.
 */
export function withoutPage(pages: CmsPage[], pageId: string): CmsPage[] {
  return pages
    .filter((p) => p.id !== pageId)
    .map((p) =>
      getParentId(p) === pageId
        ? { ...p, parentId: null, parentPageId: null }
        : p
    );
}

/** Where a page lives on the site. `linkUrl` points it at a built-in route instead of its own article. */
export function pageUrl(page: Pick<CmsPage, "slug" | "linkUrl">): string {
  return page.linkUrl || (page.slug ? `/${page.slug}` : "/");
}


export interface PageCounts {
  /** Pages at the top of the menu, and pages under one of them. */
  main: number;
  sub: number;
  /** Visible on the website now. */
  published: number;
  /** Set to be published at a later time. */
  scheduled: number;
  drafts: number;
}

/** How many pages there are, where they sit in the menu, and how many are out on the website. */
export function countPages(pages: CmsPage[], now = new Date()): PageCounts {
  const isDraft = (p: CmsPage) => p.isPublished === false || p.status === "draft";
  const published = pages.filter((p) => isPagePublished(p, now)).length;
  const drafts = pages.filter(isDraft).length;
  return {
    main: pages.filter((p) => !getParentId(p)).length,
    sub: pages.filter((p) => Boolean(getParentId(p))).length,
    published,
    scheduled: pages.length - published - drafts,
    drafts,
  };
}
