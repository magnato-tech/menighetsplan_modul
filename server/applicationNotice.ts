// The notice that a membership application has come in from Min side (see server/taskNotice.ts). The
// browser asks for it once the application is saved, and only the applicant can ask: the token must
// belong to the person the application is for. A notice goes out once per application: the application
// gets `noticeSentAt` when it has been handled, and a later request does nothing. Only an application
// made in the last hour can be asked for.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import { applicationTaskId } from "../src/utils/membershipClerkTasks";
import { readDocument, writeDocumentFields, type Fetch } from "./firestoreRest";
import { EMAIL_SETTINGS, settingOf } from "./emailSending";
import { verifiedAddressOf } from "./loginProblemReport";
import { noticeNewTask } from "./taskNotice";
import { accessToken, readServiceAccount } from "./serviceAccount";

// The names in src/data/collections.ts, written out here (see emailSending.ts for why)
const LOGINS = "logins";
const MEMBERSHIP_APPLICATIONS = "membershipApplications";
const HOUR_MS = 60 * 60 * 1000;

export interface ApplicationNoticeRequest {
  env: InstallationEnv;
  idToken: string | null;
  /** What the browser sent: {applicationId}. */
  body: unknown;
  ask: Fetch;
  now?: Date;
  /** Where the installation is, "https://menigheten.example". Taken from the request. */
  siteUrl?: string;
}

export interface ApplicationNoticeResponse {
  status: number;
  body: { ok: true; sent?: boolean } | { ok: false; reason?: string; message?: string };
}

const refuse = (status: number, reason: string, message?: string): ApplicationNoticeResponse => ({
  status,
  body: { ok: false, reason, ...(message ? { message } : {}) },
});

/** Sends the notice for a new application, once. Never throws. */
export async function noticeNewApplication({ env, idToken, body, ask, now = new Date(), siteUrl }: ApplicationNoticeRequest): Promise<ApplicationNoticeResponse> {
  const installation = readDemoInstallation(env) === null ? readInstallationConfig(env) : null;
  const account = readServiceAccount(env);
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  if (!installation || !account || account.project_id !== installation.projectId || !apiKey || !siteUrl) {
    return { status: 503, body: { ok: false, reason: "not-configured" } };
  }
  if (!idToken) return refuse(401, "not-signed-in", "Du må være logget inn.");

  const request = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const applicationId = typeof request.applicationId === "string" ? request.applicationId.trim() : "";
  if (!applicationId || applicationId.includes("/")) return refuse(400, "bad-request", "Mangler søknaden.");

  try {
    const address = await verifiedAddressOf(installation.apiKey, idToken, ask);
    if (!address) return refuse(401, "not-signed-in", "Du må være logget inn.");

    const bearer = await accessToken(account, ask, Math.floor(now.getTime() / 1000));
    const headers = { Authorization: `Bearer ${bearer}` };
    const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };

    const application = await readDocument(database, `${MEMBERSHIP_APPLICATIONS}/${applicationId}`, ask, headers);
    if (!application) return refuse(404, "not-found", "Fant ikke søknaden.");
    // Only the one the application is for: the login of the address names the person
    const login = await readDocument(database, `${LOGINS}/${encodeURIComponent(address)}`, ask, headers);
    if (typeof login?.personId !== "string" || login.personId !== application.personId) return refuse(403, "not-owner", "Søknaden er ikke din.");

    const submitted = Date.parse(String(application.submittedAt ?? ""));
    if (Number.isNaN(submitted) || now.getTime() - submitted > HOUR_MS) return refuse(409, "too-old", "Søknaden er for gammel til varsel.");
    if (typeof application.noticeSentAt === "string" && application.noticeSentAt !== "") return { status: 200, body: { ok: true, sent: false } };

    const sent = await noticeNewTask({
      database,
      env,
      ask,
      headers,
      now,
      siteUrl,
      // The application's own task is made with the application, so it is not counted as another one
      task: { summary: `Ny søknad om medlemskap fra ${String(application.applicantName ?? "ukjent")}.`, id: applicationTaskId(applicationId) },
    });
    // Marked as handled even when the notice was held back for the hour: the next one says how many are open
    await writeDocumentFields(database, `${MEMBERSHIP_APPLICATIONS}/${applicationId}`, { noticeSentAt: now.toISOString() }, ask, headers, true).catch(() =>
      console.error("Varselet om søknaden fikk ikke blitt merket som sendt.")
    );
    return { status: 200, body: { ok: true, sent: sent.sent } };
  } catch (error) {
    console.error("Varselet om søknaden fikk ikke blitt laget:", error instanceof Error ? error.message : error);
    return { status: 503, body: { ok: false, reason: "unavailable" } };
  }
}
