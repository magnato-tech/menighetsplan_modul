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
