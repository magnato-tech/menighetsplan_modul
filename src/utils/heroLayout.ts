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

type HeroFields = Pick<CmsPage, "heroHeight" | "heroTitleStyle" | "heroTitleSize" | "heroTitleFont" | "showHeroSubtext" | "summary">;

/** The height chosen for the front page picture. A page saved before the choice existed keeps the middle one. */
export function heroHeightOf(page: Partial<HeroFields> | null | undefined): HeroHeight {
  return page?.heroHeight === "low" || page?.heroHeight === "full" ? page.heroHeight : "medium";
}

export function heroTitleStyleOf(page: Partial<HeroFields> | null | undefined): HeroTitleStyle {
  return page?.heroTitleStyle === "calm" ? "calm" : "bold";
}

/** How large the headline on the picture is. */
export type HeroTitleSize = "small" | "medium" | "large" | "xlarge";

export const HERO_TITLE_SIZES: { value: HeroTitleSize; label: string }[] = [
  { value: "small", label: "Liten" },
  { value: "medium", label: "Middels" },
  { value: "large", label: "Stor" },
  { value: "xlarge", label: "Ekstra stor" },
];

/** The text size of the headline on a phone, a tablet and a large screen. */
export const HERO_TITLE_SIZE_CLASSES: Record<HeroTitleSize, string> = {
  small: "text-2xl sm:text-3xl lg:text-4xl",
  medium: "text-3xl sm:text-4xl lg:text-5xl",
  large: "text-4xl sm:text-5xl lg:text-6xl",
  xlarge: "text-5xl sm:text-6xl lg:text-7xl",
};

/** The size chosen for the headline. Unless chosen, it follows the style, as before: large when heavy, medium when calm. */
export function heroTitleSizeOf(page: Partial<HeroFields> | null | undefined): HeroTitleSize {
  const size = page?.heroTitleSize;
  if (size === "small" || size === "medium" || size === "large" || size === "xlarge") return size;
  return heroTitleStyleOf(page) === "calm" ? "medium" : "large";
}

/** The typeface of the headline on the picture: the headings' own, or one of four that come with the app. */
export type HeroTitleFont = "heading" | "rounded" | "serif" | "caps" | "script";

export const HERO_TITLE_FONTS: { value: HeroTitleFont; label: string }[] = [
  { value: "heading", label: "Som overskriftene" },
  { value: "rounded", label: "Rund og vennlig" },
  { value: "serif", label: "Klassisk serif" },
  { value: "caps", label: "Store bokstaver" },
  { value: "script", label: "Håndskrift" },
];

// The font files lie in public/skrifter (latin letters, æ, ø and å included), so a visitor fetches nothing from elsewhere
const HERO_FONT_FACES: Record<Exclude<HeroTitleFont, "heading">, { family: string; file: string; weights: string; fallback: string }> = {
  rounded: { family: "Nunito", file: "/skrifter/nunito.woff2", weights: "400 800", fallback: "ui-rounded, system-ui, sans-serif" },
  serif: { family: "Playfair Display", file: "/skrifter/playfair.woff2", weights: "400 900", fallback: "Georgia, 'Times New Roman', serif" },
  caps: { family: "Oswald", file: "/skrifter/oswald.woff2", weights: "300 700", fallback: "'Arial Narrow', system-ui, sans-serif" },
  script: { family: "Caveat", file: "/skrifter/caveat.woff2", weights: "400 700", fallback: "'Segoe Script', cursive" },
};

export function heroTitleFontOf(page: Partial<HeroFields> | null | undefined): HeroTitleFont {
  const font = page?.heroTitleFont;
  return font === "rounded" || font === "serif" || font === "caps" || font === "script" ? font : "heading";
}

/**
 * The font rule for the chosen typeface, to lie in a style element by the headline. The browser
 * downloads a font file only when a rule names it and text uses it, so only the chosen one is fetched.
 * Empty for the headings' own font.
 */
export function heroFontFaceCss(font: HeroTitleFont): string {
  if (font === "heading") return "";
  const face = HERO_FONT_FACES[font];
  return `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weights};font-display:swap;src:url(${face.file}) format('woff2');}`;
}

/** The font family for the headline, or nothing for the headings' own. */
export function heroFontFamily(font: HeroTitleFont): string | undefined {
  if (font === "heading") return undefined;
  const face = HERO_FONT_FACES[font];
  return `'${face.family}', ${face.fallback}`;
}

/** One picture at the top and the headline it shows. */
export interface HeroSlide {
  src: string;
  title: string;
}

/**
 * The extra pictures with their own titles, in step: a picture taken out takes its title with it,
 * and the ones after move up. At most two.
 */
export function heroExtrasOf(images: string[] | undefined, titles: string[] | undefined): { heroImages: string[]; heroImageTitles: string[] } {
  const kept = (images ?? [])
    .map((src, index) => ({ src, title: titles?.[index] ?? "" }))
    .filter((extra) => Boolean(extra.src))
    .slice(0, 2);
  return { heroImages: kept.map((extra) => extra.src), heroImageTitles: kept.map((extra) => extra.title) };
}

/**
 * The pictures at the top, at most three: the main one with the main headline, then the extra ones,
 * each with its own title. An extra picture without a title shows the main headline.
 */
export function heroSlidesOf(
  main: string | null | undefined,
  extras: (string | null | undefined)[],
  extraTitles: string[] | undefined,
  headline: string
): HeroSlide[] {
  return [
    { src: main || "", title: headline },
    ...extras.map((src, index) => ({ src: src || "", title: extraTitles?.[index]?.trim() || headline })),
  ]
    .filter((slide) => Boolean(slide.src))
    .slice(0, 3);
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
