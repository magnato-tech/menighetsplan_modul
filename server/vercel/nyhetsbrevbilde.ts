// The function Vercel runs for /api/nyhetsbrevbilde: the banner at the top of the newsletter,
// fetched by the inbox of everyone it goes to. The source is here, and `npm run build:api` packs
// it into api/nyhetsbrevbilde.js, which is the file Vercel reads.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { newsletterBanner } from "../newsletterBanner";

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const banner = await newsletterBanner({ env: process.env, siteUrl: host ? `https://${host}` : undefined, ask: fetch as unknown as Fetch });
  response.statusCode = banner.status;
  for (const [name, value] of Object.entries(banner.headers)) response.setHeader(name, value);
  response.end(banner.body);
}
