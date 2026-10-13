// The function Vercel runs for /api/offentlig/kalender.ics (see vercel.json). The source is
// here, and `npm run build:api` packs it into api/kalender.js, which is the file Vercel reads.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { publicCalendarFeed } from "../publicCalendarFeed";

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const site = new URL(request.url || "/", "http://localhost").searchParams.get("menighet");

  const feed = await publicCalendarFeed({
    env: process.env,
    site,
    siteUrl: host ? `https://${host}` : undefined,
    ask: fetch as unknown as Fetch,
  });

  response.statusCode = feed.status;
  for (const [name, value] of Object.entries(feed.headers)) response.setHeader(name, value);
  // Anyone may read the public calendar, also a page on another address
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.end(feed.body);
}
