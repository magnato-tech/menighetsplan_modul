import { describe } from "vitest";
import { assert } from "./assert";
import { initialCmsPages, type CmsPage } from "../src/data/cmsData";
import { buildMenuBar, buildPageTree, buildPublicMenu, countPages, findOrphanPages, withoutPage, pageUrl } from "../src/utils/menu";

describe("Menystruktur og CMS-sider", () => {
  const page = (id: string, extra: Partial<CmsPage> = {}): CmsPage => ({
    id,
    slug: id,
    title: id,
    summary: "",
    content: "",
    isPublished: true,
    inNavMenu: true,
    parentId: null,
    navOrder: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  });
  const ids = (list: CmsPage[]) => list.map((p) => p.id).join(",");

  // 1. The demo pages are well-formed
  assert(
    initialCmsPages.every((p) => typeof p.id === "string" && p.id !== "" && typeof p.title === "string" && p.title !== ""),
    "Alle demosidene har ID og tittel"
  );
  assert(
    initialCmsPages.every((p) => typeof p.isPublished === "boolean"),
    "Alle demosidene sier om de er publisert"
  );
  assert(new Set(initialCmsPages.map((p) => p.id)).size === initialCmsPages.length, "Demosidene har unike ID-er");
  assert(findOrphanPages(initialCmsPages).length === 0, "Ingen demoside peker på en overordnet side som mangler");

  // 2. The public menu built from the demo pages
  const menu = buildPublicMenu(initialCmsPages);
  assert(menu.length >= 5, `Toppmenyen har minst 5 hovedfaner (fant ${menu.length})`);
  assert(
    menu.every((node, i) => i === 0 || (menu[i - 1].page.navOrder ?? 99) <= (node.page.navOrder ?? 99)),
    "Hovedfanene står i menyrekkefølge"
  );
  const grupper = menu.find((n) => n.page.id === "page-grupper");
  assert(grupper !== undefined && grupper.children.length > 0, "Grupper og aktiviteter har underfaner");
  const utleie = menu.find((n) => n.page.id === "page-utleie");
  assert(utleie !== undefined && utleie.children.length >= 3, "Utleie har underfanene kurs, selskap og bilder");
  assert(!menu.some((n) => n.page.id === "page-personvern"), "Personvern (inNavMenu: false) står ikke i toppmenyen");

  // 3. Ordering and the two levels
  const unsorted = [
    page("b", { navOrder: 2 }),
    page("uten-rekkefolge", { navOrder: undefined }),
    page("a", { navOrder: 1 }),
    page("a2", { parentId: "a", navOrder: 2 }),
    page("a1", { parentId: "a", navOrder: 1 }),
  ];
  const tree = buildPageTree(unsorted);
  assert(ids(tree.map((n) => n.page)) === "a,b,uten-rekkefolge", "En side uten menyrekkefølge havner sist");
  assert(ids(tree[0].children) === "a1,a2", "Underfaner sorteres etter menyrekkefølge");
  assert(tree[1].children.length === 0, "En hovedfane uten underfaner får en tom liste");
  assert(ids(unsorted) === "b,uten-rekkefolge,a,a2,a1", "buildPageTree endrer ikke listen den får inn");

  // 4. What the public menu leaves out, and what the admin tree keeps
  const mixed = [
    page("synlig"),
    page("kladd", { isPublished: false }),
    page("skjult", { inNavMenu: false }),
    page("synlig-barn", { parentId: "synlig" }),
    page("kladd-barn", { parentId: "synlig", isPublished: false }),
    page("barn-av-kladd", { parentId: "kladd" }),
  ];
  const publicMenu = buildPublicMenu(mixed);
  assert(ids(publicMenu.map((n) => n.page)) === "synlig", "Kladder og sider skjult fra menyen vises ikke i den offentlige menyen");
  assert(ids(publicMenu[0].children) === "synlig-barn", "En underfane som er kladd vises ikke i den offentlige menyen");
  assert(buildPageTree(mixed).length === 3, "Admin-treet viser også kladder og skjulte sider");
  assert(
    ids(buildPageTree(mixed).find((n) => n.page.id === "kladd")?.children ?? []) === "barn-av-kladd",
    "Admin-treet viser underfanene til en kladd"
  );

  // 5. Sub-pages nothing leads to
  const withOrphans = [
    page("topp"),
    page("barn", { parentId: "topp" }),
    page("foreldrelos", { parentId: "slettet-side" }),
    page("barnebarn", { parentId: "barn" }),
  ];
  assert(ids(findOrphanPages(withOrphans)) === "foreldrelos,barnebarn", "En underfane uten gyldig hovedfane regnes som frittstående");
  assert(
    !buildPageTree(withOrphans).some((n) => n.page.id === "foreldrelos" || n.children.some((c) => c.id === "foreldrelos")),
    "En frittstående side står ikke i treet"
  );

  // 6. Deleting a page
  const family = [page("forelder"), page("barn-1", { parentId: "forelder" }), page("barn-2", { parentId: "forelder" }), page("annen")];
  const afterParentDelete = withoutPage(family, "forelder");
  assert(ids(afterParentDelete) === "barn-1,barn-2,annen", "Sletting fjerner bare siden selv");
  assert(
    afterParentDelete.every((p) => p.parentId === null),
    "Underfanene til en slettet hovedfane blir hovedfaner"
  );
  assert(findOrphanPages(afterParentDelete).length === 0, "Sletting av en hovedfane etterlater ingen frittstående sider");
  assert(family[1].parentId === "forelder", "withoutPage endrer ikke sidene den får inn");
  const afterChildDelete = withoutPage(family, "barn-1");
  assert(
    ids(afterChildDelete) === "forelder,barn-2,annen" && afterChildDelete[1].parentId === "forelder",
    "Sletting av en underfane rører ikke søsknene"
  );

  // 7. Where a page lives
  assert(pageUrl({ slug: "om-oss" }) === "/om-oss", "En side ligger under sin egen slug");
  assert(pageUrl({ slug: "kalender", linkUrl: "/hva-skjer" }) === "/hva-skjer", "linkUrl overstyrer slug");
  assert(pageUrl({ slug: "" }) === "/", "En side uten slug er forsiden");

  // 8. Dual support: parentPageId / parentId og menuOrder / navOrder
  const modernPages: CmsPage[] = [
    page("hoved-1", { menuOrder: 1, parentPageId: null }),
    page("under-1", { menuOrder: 1, parentPageId: "hoved-1" }),
    page("under-2", { menuOrder: 2, parentPageId: "hoved-1" }),
    page("hoved-2", { menuOrder: 2, parentPageId: null }),
  ];
  const modernTree = buildPageTree(modernPages);
  assert(modernTree.length === 2, "buildPageTree håndterer parentPageId: null som hovedfane");
  assert(modernTree[0].children.length === 2, "buildPageTree grupperer underfaner etter parentPageId");
  assert(ids(modernTree[0].children) === "under-1,under-2", "Underfaner sorteres etter menuOrder");

  const mixedPages: CmsPage[] = [
    page("legacy-parent", { navOrder: 1, parentId: null }),
    page("modern-child", { menuOrder: 1, parentPageId: "legacy-parent" }),
    page("legacy-child", { navOrder: 2, parentId: "legacy-parent" }),
  ];
  const mixedTree = buildPageTree(mixedPages);
  assert(mixedTree[0].children.length === 2, "Blandet bruk av parentPageId og parentId fungerer sømløst");
  assert(ids(mixedTree[0].children) === "modern-child,legacy-child", "Blandet sortering med menuOrder og navOrder fungerer");

  const afterModernDelete = withoutPage(modernPages, "hoved-1");
  assert(
    afterModernDelete.every((p) => p.parentPageId === null && p.parentId === null),
    "withoutPage nullstiller både parentPageId og parentId"
  );

  // 9. Dra-og-slipp rekkefølge (menuOrder / navOrder)
  const initialList = [page("p1", { menuOrder: 1 }), page("p2", { menuOrder: 2 }), page("p3", { menuOrder: 3 })];
  // Dra p3 foran p1 -> ["p3", "p1", "p2"]
  const reorderedIds = ["p3", "p1", "p2"];
  const updatedList = initialList.map((p) => {
    const newIdx = reorderedIds.indexOf(p.id);
    return { ...p, menuOrder: newIdx + 1, navOrder: newIdx + 1 };
  });
  const reorderedTree = buildPageTree(updatedList);
  assert(ids(reorderedTree.map((n) => n.page)) === "p3,p1,p2", "Sider sorteres etter oppdatert menuOrder etter dra-og-slipp");
  assert(reorderedTree[0].page.menuOrder === 1, "Første element etter reorder har menuOrder 1");
  assert(reorderedTree[1].page.menuOrder === 2, "Andre element etter reorder har menuOrder 2");
  assert(reorderedTree[2].page.menuOrder === 3, "Tredje element etter reorder har menuOrder 3");

  // Counting for the overview: the menu, and what is out on the website
  {
    const now = new Date("2026-10-20T10:00:00.000Z");
    const counted = countPages(
      [
        page("a"),
        page("b", { isPublished: false }),
        page("c", { parentId: "a" }),
        page("d", { parentId: "a", publishAt: "2026-11-01T10:00:00.000Z" }),
        page("e", { status: "draft", parentId: "a" }),
      ],
      now
    );
    assert(counted.main === 2 && counted.sub === 3, "Hovedfaner og underfaner telles hver for seg");
    assert(counted.published === 2, "Bare det som er ute på nettsiden nå, telles som publisert");
    assert(counted.scheduled === 1 && counted.drafts === 2, "Planlagte sider og kladder telles hver for seg");
    assert(counted.published + counted.scheduled + counted.drafts === 5, "Hver side telles én gang");
  }

  // The menu bar at the top of the page list in the admin
  {
    const now = new Date("2026-10-20T10:00:00.000Z");
    const bar = buildMenuBar(
      buildPageTree([
        page("om-oss", { navOrder: 2 }),
        page("forside", { navOrder: 1 }),
        page("kladd", { navOrder: 3, isPublished: false }),
        page("skjult", { navOrder: 4, inNavMenu: false }),
        page("visjon", { parentId: "om-oss", navOrder: 1, publishAt: "2026-11-01T10:00:00.000Z" }),
      ]),
      now
    );
    assert(bar.map((item) => item.id).join(",") === "forside,om-oss,kladd,skjult", "Menylinjen har hovedfanene i menyens rekkefølge, også kladder og skjulte");
    assert(bar[2].state === "draft" && bar[3].state === "hidden" && bar[0].state === "published", "Menylinjen merker kladder og sider som ikke står i menyen");
    assert(bar[1].children.length === 1 && bar[1].children[0].state === "scheduled", "Undersidene står under hovedfanen, merket når de er planlagt");
  }
});
