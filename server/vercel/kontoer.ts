// The function Vercel runs for /api/kontoer: the accounts of the installation, for the Innlogging tab
// in the admin (see server/accountList.ts). The source is here, and `npm run build:api` packs it into
// api/kontoer.js, which is the file Vercel reads.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Fetch } from "../firestoreRest";
import { listAccounts } from "../accountList";

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse): Promise<void> {
  const answer = (status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(body));
  };

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return answer(405, { ok: false, message: "Innloggingsoversikten hentes med GET." });
  }

  const authorization = first(request.headers.authorization) ?? "";
  const result = await listAccounts({
    env: process.env,
    idToken: /^Bearer\s+\S/.test(authorization) ? authorization.replace(/^Bearer\s+/, "").trim() : null,
    ask: fetch as unknown as Fetch,
  });
  answer(result.status, result.body);
}
