// The function Vercel runs for /api/epost: e-mail from the administration to leaders and
// volunteers. The source is here, and `npm run build:api` packs it into api/epost.js, which is
// the file Vercel reads.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { sendEmail } from "../emailSending";

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** What was sent, as it was written. Vercel has usually read it already; otherwise it is read here. */
async function bodyOf(request: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (request.body !== undefined) {
    if (typeof request.body !== "string") return request.body;
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const piece = typeof part === "string" ? Buffer.from(part) : (part as Buffer);
    size += piece.length;
    if (size > 100_000) return null;
    parts.push(piece);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    return null;
  }
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse): Promise<void> {
  const answer = (status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(body));
  };

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return answer(405, { ok: false, reason: "bad-request", message: "E-post sendes fra admin." });
  }

  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const authorization = first(request.headers.authorization) ?? "";
  const result = await sendEmail({
    env: process.env,
    siteUrl: host ? `https://${host}` : undefined,
    idToken: /^Bearer\s+\S/.test(authorization) ? authorization.replace(/^Bearer\s+/, "").trim() : null,
    body: await bodyOf(request),
    ask: fetch as unknown as Fetch,
  });
  answer(result.status, result.body);
}
