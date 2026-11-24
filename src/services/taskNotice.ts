import { auth } from "../firebase";

// The applicant's browser asks for the notice that a membership application has come in, once the
// application is saved (see server/applicationNotice.ts). Here is only the asking: it never throws,
// and the applicant is never held up by it.

/** Where the request is sent. Only an installation at the hosting has it. */
export const APPLICATION_NOTICE_PATH = "/api/oppgavevarsel";

/** Asks for the notice of a new application, which the one who sent it is the only one to ask for. */
export async function noticeNewApplication(applicationId: string): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch(APPLICATION_NOTICE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ applicationId }),
    });
  } catch {
    // The application is saved already; a missed notice is for the board to see as an open task anyway
  }
}
