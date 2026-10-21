import type { CmsPage } from "../data/cmsData";

/** The address «slug-kopi», or «slug-kopi-2» and on when that is taken. */
export function copySlug(slug: string, pages: Pick<CmsPage, "slug">[]): string {
  const base = `${slug.trim() || "forside"}-kopi`;
  const taken = new Set(pages.map((page) => page.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * A copy of a page, to be opened in the editor as a new page: the same blocks, picture and settings,
 * with «(kopi)» after the title and an address of its own. It is a draft outside the menu, so nothing
 * changes on the website until it is published; and nothing is stored until it is saved.
 */
export function pageCopyOf(page: CmsPage, pages: CmsPage[]): Partial<CmsPage> {
  const { id: _id, updatedAt: _updatedAt, updatedBy: _updatedBy, publishAt: _publishAt, publishedAt: _publishedAt, status: _status, ...rest } = page;
  const parent = page.parentPageId !== undefined ? page.parentPageId : page.parentId ?? null;
  const siblings = pages.filter((candidate) => (candidate.parentPageId !== undefined ? candidate.parentPageId : candidate.parentId ?? null) === parent);
  const order = siblings.length + 1;
  return {
    ...rest,
    title: `${page.title} (kopi)`,
    slug: copySlug(page.slug, pages),
    // The copy of a page with an address of its own, such as the front page, is an ordinary page
    linkUrl: undefined,
    isPublished: false,
    inNavMenu: false,
    parentPageId: parent,
    parentId: parent,
    menuOrder: order,
    navOrder: order,
  };
}
