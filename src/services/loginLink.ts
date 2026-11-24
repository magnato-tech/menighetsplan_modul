// The request that turns a personal login link into a sign-in (see utils/loginLink.ts). The server
// checks the token and answers with a custom token for the account (server/loginLinkRedeem.ts).
// Here is only the asking: it never throws, and what went wrong comes back as the answer.

/** Where the request is sent. Only an installation at the hosting has it. */
export const LOGIN_LINK_API_PATH = "/api/innlogging";

export type LoginLinkAnswer = { ok: true; customToken: string } | { ok: false; message: string };

export async function exchangeLoginLink(token: string): Promise<LoginLinkAnswer> {
  try {
    const response = await fetch(LOGIN_LINK_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const answer = (await response.json().catch(() => null)) as { ok?: unknown; customToken?: unknown; message?: unknown } | null;
    if (response.ok && answer?.ok === true && typeof answer.customToken === "string") return { ok: true, customToken: answer.customToken };
    return { ok: false, message: typeof answer?.message === "string" ? answer.message : "Innloggingen gikk ikke. Prøv igjen." };
  } catch {
    return { ok: false, message: "Ingen forbindelse. Sjekk nettet, og prøv igjen." };
  }
}
