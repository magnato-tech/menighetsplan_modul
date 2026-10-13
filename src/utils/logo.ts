// The congregation's logo: one picture, shown at the top of the website and on the sign-in page
// in place of the name written out. The congregation can keep it off the top of the website,
// where it stands on a light plate over the front page's picture, and still have it on the
// sign-in page.
//
// It is kept as text inside the settings document (a data address), so it follows the settings
// wherever they go: into a dataset, and to every visitor together with the name of the
// congregation. That is also why it has to be small.

/** The kinds of picture a logo can be. */
export const LOGO_TYPES: readonly string[] = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];

/** A logo is never larger than this as a file: the settings are fetched on every visit. */
export const LOGO_MAX_BYTES = 200_000;

/** Why the file cannot be the logo, in words for the one who chose it. Null when it can. */
export function logoFileError(file: { type: string; size: number }): string | null {
  if (!LOGO_TYPES.includes(file.type)) return "Logoen må være et bilde av typen PNG, SVG, JPG eller WebP.";
  if (file.size > LOGO_MAX_BYTES) return `Logoen er for stor (${Math.round(file.size / 1000)} kB). Den kan være opptil ${LOGO_MAX_BYTES / 1000} kB.`;
  if (file.size === 0) return "Filen er tom.";
  return null;
}

/** The logo as the settings hold it, or nothing when no logo is set. Only a picture is ever shown as one. */
export function logoOf(settings: { logoUrl?: string }): string | undefined {
  const url = settings.logoUrl?.trim();
  return url && (url.startsWith("data:image/") || url.startsWith("https://")) ? url : undefined;
}

/** The logo at the top of the website: the logo, unless the congregation has taken it off there. */
export function menuLogoOf(settings: { logoUrl?: string; hideLogoInMenu?: boolean }): string | undefined {
  return settings.hideLogoInMenu === true ? undefined : logoOf(settings);
}
