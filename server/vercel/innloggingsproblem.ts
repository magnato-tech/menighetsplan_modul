// The function Vercel runs for /api/innloggingsproblem: a signed-in account that the register does not
// know tells the board, so the protokollansvarlig can find out who it is (see server/loginProblemReport.ts).
// The source is here, and `npm run build:api` packs it into api/innloggingsproblem.js, which is the file Vercel reads.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { reportLoginProblem } from "../loginProblemReport";

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse): Promise<void> {
  const answer = (status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(body));
  };

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return answer(405, { ok: false, reason: "bad-request" });
  }

  const authorization = first(request.headers.authorization) ?? "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const result = await reportLoginProblem({
    env: process.env,
    idToken: idToken || null,
    siteUrl: host ? `https://${host}` : undefined,
    ask: fetch as unknown as Fetch,
  });
  answer(result.status, result.body);
}
