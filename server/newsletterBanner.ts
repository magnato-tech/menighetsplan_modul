// The banner at the top of the newsletter, served where the installation is hosted (see
// server/vercel/nyhetsbrevbilde.ts). An inbox shows a picture fetched from an address, and seldom
// one carried inside the e-mail, while a picture uploaded in admin is stored as text in the
// database. This reads the stored banner without being signed in, as the inbox does, and answers
// with the picture itself.

import { readInstallationConfig, type InstallationEnv } from "../src/installation";
import { newsletterBannerOf } from "../src/utils/newsletter";
import { readDocument, type Fetch } from "./firestoreRest";

// The name in src/data/settingsRecords.ts, written out: that file is the browser's
// (tests/newsletter.test.ts holds the two together)
export const NEWSLETTER_BANNER_DOCUMENT = "cms_settings/newsletter-banner";

export interface BannerRequest {
  env: InstallationEnv;
  /** Where the website is: a banner from the picture library has an address there. */
  siteUrl?: string;
  ask: Fetch;
}

export interface BannerResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

const missing: BannerResponse = { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: "Nyhetsbrevet har ikke noe toppbilde." };

export async function newsletterBanner({ env, siteUrl, ask }: BannerRequest): Promise<BannerResponse> {
  const installation = readInstallationConfig(env);
  if (!installation) return missing;
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const record = await readDocument(database, NEWSLETTER_BANNER_DOCUMENT, ask).catch(() => null);
  const banner = newsletterBannerOf(record?.imageUrl);
  if (!banner) return missing;

  // The address changes when the banner does (newsletterBannerUrlOf), so the inbox may keep it long
  const kept = "public, max-age=86400";
  if (banner.kind === "stored") return { status: 200, headers: { "Content-Type": banner.contentType, "Cache-Control": kept }, body: Buffer.from(banner.base64, "base64") };
  const url = banner.url.startsWith("/") ? (siteUrl ? `${siteUrl.replace(/\/+$/, "")}${banner.url}` : null) : banner.url;
  return url ? { status: 302, headers: { Location: url, "Cache-Control": kept }, body: "" } : missing;
}
