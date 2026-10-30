import { readInstallationConfig, type InstallationEnv } from "../src/installation";
import { SURFACES_RECORD } from "../src/data/settingsRecords";
import { parseSurfaces, icalFeedUrl } from "../src/utils/surfaces";
import { readDocument, type Fetch } from "./firestoreRest";

const SURFACES_PATH = "cms_settings/surfaces";

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface IcalImportResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Loads the congregation's iCal feed using the URL in cms_settings/surfaces. Ignores query parameters. */
export async function externalCalendarIcs({
  env,
  ask,
  httpFetch,
}: {
  env: InstallationEnv;
  ask: Fetch;
  httpFetch: HttpFetch;
}): Promise<IcalImportResult> {
  const plain = (status: number, body: string): IcalImportResult => ({
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body,
  });

  const installation = readInstallationConfig(env);
  if (!installation) return plain(500, "Kalenderimporten er ikke satt opp: installasjonen mangler innstillingene sine.");

  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const doc = await readDocument(database, SURFACES_PATH, ask);
  const surfaces = parseSurfaces(doc && doc.recordType === SURFACES_RECORD ? (doc as Record<string, unknown>) : undefined);

  if (surfaces.ownWebsite) return plain(404, "Kalenderimport er bare når vår nettside er av.");
  const feedUrl = icalFeedUrl(surfaces);
  if (!feedUrl) return plain(404, "Ingen iCal-adresse er lagret.");

  let response: Response;
  try {
    response = await httpFetch(feedUrl, { headers: { Accept: "text/calendar,*/*" } });
  } catch (error) {
    console.error("Kunne ikke hente ekstern kalender:", error);
    return plain(502, "Kunne ikke nå kirkens kalender.");
  }

  const text = await response.text();
  if (!response.ok) return plain(502, `Kirkens kalender svarte ${response.status}.`);
  if (!text.includes("BEGIN:VCALENDAR")) {
    if (/^\s*<!doctype html/i.test(text) || /CalendarEmbed/i.test(text)) {
      return plain(
        502,
        "Adressen peker på innbygging (HTML), ikke iCal. Lim inn iCal-adressen (…/basic.ics), ikke embed-lenken."
      );
    }
    return plain(502, "Svaret var ikke en gyldig kalenderfil.");
  }
  return plain(200, text);
}
