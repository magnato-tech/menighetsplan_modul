import type { CmsSettings } from "../data/cmsData";

export type SocialKind = "facebook" | "instagram" | "youtube";
type SocialKey = "facebookUrl" | "instagramUrl" | "youtubeUrl";

/** The social media a congregation can link to, in the order the icons stand. */
export const SOCIAL_FIELDS: { kind: SocialKind; key: SocialKey; label: string; placeholder: string }[] = [
  { kind: "facebook", key: "facebookUrl", label: "Facebook", placeholder: "https://www.facebook.com/menigheten" },
  { kind: "instagram", key: "instagramUrl", label: "Instagram", placeholder: "https://www.instagram.com/menigheten" },
  { kind: "youtube", key: "youtubeUrl", label: "YouTube", placeholder: "https://www.youtube.com/@menigheten" },
];

export interface SocialLink {
  kind: SocialKind;
  label: string;
  url: string;
}

/** A link as written in the settings, made into an address a browser opens. Anything else is no link. */
export function socialUrlOf(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The links that are filled in, each with an address a browser opens. A field left empty has no icon. */
export function socialLinksOf(settings: Partial<Pick<CmsSettings, SocialKey>>): SocialLink[] {
  return SOCIAL_FIELDS.flatMap(({ kind, key, label }) => {
    const url = socialUrlOf(settings[key]);
    return url ? [{ kind, label, url }] : [];
  });
}

/** Whether the icons stand in the menu at the top. They do unless switched off. */
export function socialInMenu(settings: Pick<CmsSettings, "showSocialInMenu">): boolean {
  return settings.showSocialInMenu !== false;
}
