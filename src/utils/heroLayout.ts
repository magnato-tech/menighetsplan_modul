import type { CmsPage } from "../data/cmsData";

/** How tall the picture at the top of the front page is. */
export type HeroHeight = "low" | "medium" | "full";
/** How the headline on the picture looks: heavy and large, or lighter and calmer. */
export type HeroTitleStyle = "bold" | "calm";

export const HERO_HEIGHTS: { value: HeroHeight; label: string }[] = [
  { value: "low", label: "Lav – plass til innholdet under" },
  { value: "medium", label: "Middels" },
  { value: "full", label: "Hele skjermen" },
];

export const HERO_TITLE_STYLES: { value: HeroTitleStyle; label: string }[] = [
  { value: "bold", label: "Kraftig" },
  { value: "calm", label: "Rolig" },
];

type HeroFields = Pick<CmsPage, "heroHeight" | "heroTitleStyle" | "showHeroSubtext" | "summary">;

/** The height chosen for the front page picture. A page saved before the choice existed keeps the middle one. */
export function heroHeightOf(page: Partial<HeroFields> | null | undefined): HeroHeight {
  return page?.heroHeight === "low" || page?.heroHeight === "full" ? page.heroHeight : "medium";
}

export function heroTitleStyleOf(page: Partial<HeroFields> | null | undefined): HeroTitleStyle {
  return page?.heroTitleStyle === "calm" ? "calm" : "bold";
}

/**
 * The line under the headline: the page's own, else the one in the website settings. Switched off,
 * there is none, whatever the settings say.
 */
export function heroSubtextOf(
  page: Partial<HeroFields> | null | undefined,
  settings: { welcomeSubtext?: string },
  fallback: string
): string {
  if (page?.showHeroSubtext === false) return "";
  return page?.summary?.trim() || settings.welcomeSubtext?.trim() || fallback;
}

/** What lies behind the menu at the top of the front page: nothing, a faint shade, or the white bar with the picture below it. */
export type HeroMenuStyle = "clear" | "shade" | "white";
/** How dark a veil lies over the picture, so the text can be read: none, light, or dark. */
export type HeroVeil = "none" | "light" | "dark";

export const HERO_MENU_STYLES: { value: HeroMenuStyle; label: string }[] = [
  { value: "clear", label: "Over bildet, uten bakgrunn" },
  { value: "shade", label: "Over bildet, med svak skygge" },
  { value: "white", label: "Hvit linje, bildet under" },
];

export const HERO_VEILS: { value: HeroVeil; label: string }[] = [
  { value: "none", label: "Ingen – rent bilde" },
  { value: "light", label: "Lett" },
  { value: "dark", label: "Mørkt" },
];

/**
 * The menu's background on the front page. A page saved before the choice existed has it from the
 * older on/off choice: on gave the shade, off the white bar.
 */
export function heroMenuStyleOf(page: Partial<Pick<CmsPage, "heroMenuStyle" | "heroMenuOverlay">> | null | undefined): HeroMenuStyle {
  const style = page?.heroMenuStyle;
  if (style === "clear" || style === "shade" || style === "white") return style;
  return page?.heroMenuOverlay === false ? "white" : "shade";
}

/** The veil over the front page picture. Dark, as it has always been, unless chosen. */
export function heroVeilOf(page: Partial<Pick<CmsPage, "heroVeil">> | null | undefined): HeroVeil {
  return page?.heroVeil === "none" || page?.heroVeil === "light" ? page.heroVeil : "dark";
}

/**
 * The starting point for a page that has not chosen: no buttons and no line under the headline on
 * the picture. Few congregations use them, so a new page and the demo begin without. A choice the
 * page has made is kept.
 */
export const QUIET_HERO = { showHeroPrimaryCta: false, showHeroSecondaryCta: false, showHeroSubtext: false } as const;

export function withQuietHero<T extends object>(page: T): T {
  const chosen = page as Partial<Pick<CmsPage, "showHeroPrimaryCta" | "showHeroSecondaryCta" | "showHeroSubtext">>;
  return {
    ...page,
    showHeroPrimaryCta: chosen.showHeroPrimaryCta ?? QUIET_HERO.showHeroPrimaryCta,
    showHeroSecondaryCta: chosen.showHeroSecondaryCta ?? QUIET_HERO.showHeroSecondaryCta,
    showHeroSubtext: chosen.showHeroSubtext ?? QUIET_HERO.showHeroSubtext,
  };
}
