import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { externalCalendarIcs } from "../icalImport";

export default async function handler(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const feed = await externalCalendarIcs({
    env: process.env,
    ask: fetch as unknown as Fetch,
    httpFetch: fetch,
  });

  response.statusCode = feed.status;
  for (const [name, value] of Object.entries(feed.headers)) response.setHeader(name, value);
  response.end(feed.body);
}
