// The function Vercel runs for /api/innlogging: signs someone in with the personal link from an
// e-mail (see server/loginLinkRedeem.ts). The source is here, and `npm run build:api` packs it into
// api/innlogging.js, which is the file Vercel reads.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { redeemLoginLink } from "../loginLinkRedeem";

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
    if (size > 10_000) return null;
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
    return answer(405, { ok: false, message: "Innloggingen gjøres fra lenken i e-posten." });
  }

  const result = await redeemLoginLink({ env: process.env, body: await bodyOf(request), ask: fetch as unknown as Fetch });
  answer(result.status, result.body);
}
