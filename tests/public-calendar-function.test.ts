import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import { API_FUNCTIONS, packFunction, packedPathOf } from "../scripts/build-api";
import { decodeDocument, readWhereTrue, whereTrueQuery, type Fetch, type RestFields } from "../server/firestoreRest";
import { GATHERINGS, SETTINGS_DOCUMENT, publicCalendarFeed, siteOfRequest } from "../server/publicCalendarFeed";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, COLLECTIONS } from "../src/data/collections";
import { PUBLIC_CALENDAR_FEED_PATH } from "../src/utils/calendarFeed";

// The public calendar as a subscription, where the installation is hosted: a function that reads
// what a visitor may read, and answers with a calendar file.

const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
};
const now = new Date("2026-10-13T10:00:00.000Z");

const text = (value: string) => ({ stringValue: value });
const eventDocument = (id: string, fields: RestFields) => ({
  document: { name: `projects/menigheten/databases/(default)/documents/gatherings/${id}`, fields },
  readTime: "2026-10-13T10:00:00Z",
});
const service = eventDocument("gudstjeneste-1", {
  title: text("Gudstjeneste"),
  startsAt: text("2026-10-25T10:00:00.000Z"),
  location: text("Bedehuset"),
  visibility: text("offentlig"),
  isPublic: { booleanValue: true },
  type: text("arrangement"),
  groupId: text("kalender"),
  programSchedule: { arrayValue: { values: [{ mapValue: { fields: { title: text("Lovsang"), minutes: { integerValue: "10" } } } }] } },
});
const houseGroup = eventDocument("husgruppe-1", {
  title: text("Husgruppe 1"),
  startsAt: text("2026-10-27T17:00:00.000Z"),
  visibility: text("offentlig"),
  isPublic: { booleanValue: true },
  type: text("gruppesamling"),
});
const broken = eventDocument("uten-dato", { title: text("Uten dato"), isPublic: { booleanValue: true } });

/** A database that answers the two questions the function asks, and remembers what it was asked. */
const database = (rows: unknown[], settings: RestFields | null = { churchName: text("Lillesand Misjonskirke") }) => {
  const asked: { url: string; body?: unknown }[] = [];
  const ask: Fetch = async (url, init) => {
    asked.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith(":runQuery")) return { ok: true, status: 200, json: async () => rows };
    return settings ? { ok: true, status: 200, json: async () => ({ name: `${url}`, fields: settings }) } : { ok: false, status: 404, json: async () => ({}) };
  };
  return { ask, asked };
};

afterEach(() => vi.unstubAllGlobals());

describe("Det databasen svarer med, lest uten Firebase-klienten", () => {
  test("et dokument blir slik appen holder det, med id fra navnet når ingen er lagret", () => {
    const decoded = decodeDocument(service.document);
    expect(decoded).toMatchObject({ id: "gudstjeneste-1", title: "Gudstjeneste", isPublic: true, programSchedule: [{ title: "Lovsang", minutes: 10 }] });
    expect(decodeDocument({ name: "x/y/dok", fields: { id: text("egen-id"), ingenting: { nullValue: null } } })).toEqual({ id: "egen-id", ingenting: null });
  });

  test("spørsmålet er det nettsiden stiller for en besøkende: bare det som er merket offentlig", async () => {
    const { ask, asked } = database([service]);
    await readWhereTrue({ projectId: "menigheten" }, "gatherings", "isPublic", ask);
    expect(asked[0].url).toBe("https://firestore.googleapis.com/v1/projects/menigheten/databases/(default)/documents:runQuery");
    expect(asked[0].body).toEqual(whereTrueQuery("gatherings", "isPublic"));
    expect(whereTrueQuery("gatherings", "isPublic").structuredQuery.where.fieldFilter).toEqual({ field: { fieldPath: "isPublic" }, op: "EQUAL", value: { booleanValue: true } });
  });

  test("en tom samling er en tom liste, og et nei fra databasen er en feil", async () => {
    expect(await readWhereTrue({ projectId: "p" }, "gatherings", "isPublic", database([{ readTime: "2026-10-13T10:00:00Z" }]).ask)).toEqual([]);
    await expect(readWhereTrue({ projectId: "p" }, "gatherings", "isPublic", database([{ error: { code: 403, message: "Missing or insufficient permissions." } }]).ask)).rejects.toMatchObject({ status: 403 });
    const refused: Fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    await expect(readWhereTrue({ projectId: "p" }, "gatherings", "isPublic", refused)).rejects.toMatchObject({ status: 403 });
  });

  test("navnene er de samme som appen bruker", () => {
    expect(GATHERINGS).toBe(COLLECTIONS.GATHERINGS);
    expect(SETTINGS_DOCUMENT).toBe(`${CMS_COLLECTIONS.SETTINGS}/${CMS_SETTINGS_DOC_ID}`);
  });
});

describe("Den offentlige kalenderen som abonnement", () => {
  test("svaret er en kalenderfil med menighetens navn og arrangementene en besøkende ser", async () => {
    const { ask, asked } = database([service, houseGroup, broken]);
    const feed = await publicCalendarFeed({ env, ask, now, siteUrl: "https://lillesandmisjonskirke.menighetsplan.no" });

    expect(feed.status).toBe(200);
    expect(feed.headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(feed.headers["Cache-Control"]).toContain("max-age=300");
    expect(feed.body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.body).toContain("X-WR-CALNAME:Lillesand Misjonskirke");
    // The service is there. A group's own gathering is not, and neither is the one without a date.
    expect(feed.body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(feed.body).toContain("SUMMARY:Gudstjeneste");
    expect(feed.body).toContain("DTSTART:20261025T100000Z");
    expect(feed.body).toContain("LOCATION:Bedehuset");
    expect(feed.body).toContain("URL:https://lillesandmisjonskirke.menighetsplan.no/arrangement/gudstjeneste-1");
    expect(asked.map((question) => question.url.split("/documents")[1])).toEqual([":runQuery", "/cms_settings/global"]);
  });

  test("uten innstillinger for nettsiden heter kalenderen «Menighetsplan»", async () => {
    const feed = await publicCalendarFeed({ env, ask: database([service], null).ask, now });
    expect(feed.status).toBe(200);
    expect(feed.body).toContain("X-WR-CALNAME:Menighetsplan");
  });

  test("ingen offentlige arrangementer gir en tom kalender, ikke en feil", async () => {
    const feed = await publicCalendarFeed({ env, ask: database([{ readTime: "2026-10-13T10:00:00Z" }]).ask, now });
    expect(feed.status).toBe(200);
    expect(feed.body).not.toContain("BEGIN:VEVENT");
    expect(feed.body.endsWith("END:VCALENDAR")).toBe(true);
  });

  test("sier databasen nei, er svaret en feil i klartekst, ikke en kalender", async () => {
    vi.stubGlobal("console", { ...console, error: vi.fn() });
    const feed = await publicCalendarFeed({ env, ask: database([{ error: { code: 403, message: "Missing or insufficient permissions." } }]).ask, now });
    expect(feed.status).toBe(502);
    expect(feed.headers["Content-Type"]).toContain("text/plain");
    expect(feed.headers["Cache-Control"]).toBe("no-store");
    expect(feed.body).not.toContain("permissions");
  });

  test("en installasjon uten innstillinger sier fra", async () => {
    const feed = await publicCalendarFeed({ env: {}, ask: database([service]).ask, now });
    expect(feed.status).toBe(500);
  });

  test("i demoen leses menigheten adressen ber om, og hos en menighet finnes bare den selv", async () => {
    const demo = { ...env, VITE_DEMO: "true" };
    expect(siteOfRequest(demo, "floy")).toBe("floy");
    expect(siteOfRequest(demo, "eksempel")).toBeNull();
    expect(siteOfRequest(demo, "../persons")).toBeNull();
    expect(siteOfRequest(env, "floy")).toBeNull();

    const inDemo = database([service]);
    await publicCalendarFeed({ env: demo, site: "floy", ask: inDemo.ask, now });
    expect((inDemo.asked[0].body as ReturnType<typeof whereTrueQuery>).structuredQuery.from).toEqual([{ collectionId: "floy-gatherings" }]);
    expect(inDemo.asked[1].url.endsWith("/documents/floy-cms_settings/global")).toBe(true);

    const atChurch = database([service]);
    await publicCalendarFeed({ env, site: "floy", ask: atChurch.ask, now });
    expect((atChurch.asked[0].body as ReturnType<typeof whereTrueQuery>).structuredQuery.from).toEqual([{ collectionId: "gatherings" }]);
  });
});

describe("Funksjonen slik Vercel leser den", () => {
  const normal = (file: string) => file.replace(/\r\n/g, "\n");

  test("api/kalender.js er pakket fra kilden slik den er nå (kjør «npm run build:api» etter en endring)", async () => {
    expect(Object.keys(API_FUNCTIONS)).toContain("kalender");
    expect(normal(readFileSync(packedPathOf("kalender"), "utf8"))).toBe(normal(await packFunction("kalender")));
  });

  test("det samme gjelder alle funksjonene, også e-postutsendingen i api/epost.js", async () => {
    expect(Object.keys(API_FUNCTIONS)).toEqual(["kalender", "epost", "nyhetsbrevbilde"]);
    for (const name of Object.keys(API_FUNCTIONS) as (keyof typeof API_FUNCTIONS)[]) {
      expect(normal(readFileSync(packedPathOf(name), "utf8")), `api/${name}.js`).toBe(normal(await packFunction(name)));
    }
  });

  test("den pakkede e-postfunksjonen tar bare imot POST, og svarer nei uten innlogging", async () => {
    vi.stubGlobal("process", { ...process, env: { ...env, RESEND_API_KEY: "re_test" } });
    const asked = vi.fn();
    vi.stubGlobal("fetch", asked);
    const { default: handler } = (await import(/* @vite-ignore */ pathToFileURL(packedPathOf("epost")).href)) as {
      default: (request: unknown, response: unknown) => Promise<void>;
    };
    const answerTo = async (request: object) => {
      const headers: Record<string, string> = {};
      const response = { statusCode: 0, body: "", setHeader: (name: string, value: string) => void (headers[name] = value), end(body: string) { this.body = body; } };
      await handler(request, response);
      return { status: response.statusCode, headers, body: JSON.parse(response.body) as { ok: boolean; reason?: string } };
    };

    const read = await answerTo({ method: "GET", url: "/api/epost", headers: { host: "menigheten.example" } });
    expect(read.status).toBe(405);
    expect(read.headers.Allow).toBe("POST");

    const anonymous = await answerTo({ method: "POST", url: "/api/epost", headers: { host: "menigheten.example" }, body: { mode: "test", subject: "Prøve", text: "Hei", link: "minside" } });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toMatchObject({ ok: false, reason: "not-signed-in" });
    expect(anonymous.headers["Cache-Control"]).toBe("no-store");
    expect(asked).not.toHaveBeenCalled();
  });

  test("adressen knappene bruker, fører til funksjonen, og resten av /api er ikke nettsiden", () => {
    const { rewrites } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { rewrites: { source: string; destination: string }[] };
    expect(rewrites[0]).toEqual({ source: PUBLIC_CALENDAR_FEED_PATH, destination: "/api/kalender" });
    const site = new RegExp(`^${rewrites[1].source}$`);
    expect(rewrites[1].destination).toBe("/index.html");
    expect(site.test("/kalender")).toBe(true);
    expect(site.test("/arrangement/abc")).toBe(true);
    expect(site.test("/api/offentlig/arrangementer")).toBe(false);
    expect(site.test("/api/min/kalender.ics")).toBe(false);
  });

  test("skjermene lenker ikke til adresser under /api som ikke svarer der løsningen er i drift", () => {
    const filesIn = (folder: URL): URL[] =>
      readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? filesIn(new URL(`${entry.name}/`, folder)) : /\.tsx?$/.test(entry.name) ? [new URL(entry.name, folder)] : []
      );
    const screens = [...filesIn(new URL("../src/components/", import.meta.url)), ...filesIn(new URL("../src/pages/", import.meta.url))];
    expect(screens.length).toBeGreaterThan(100);
    const offending = screens.filter((file) => /["'`]\/api\/|personalCalendarFeedUrl|PERSONAL_CALENDAR_FEED_PATH/.test(readFileSync(file, "utf8"))).map((file) => file.pathname.split("/src/")[1]);
    expect(offending).toEqual([]);
  });

  test("den pakkede funksjonen svarer med kalenderen, med adressen den ble spurt på", async () => {
    vi.stubGlobal("fetch", database([service]).ask);
    vi.stubGlobal("process", { ...process, env });
    const { default: handler } = (await import(/* @vite-ignore */ pathToFileURL(packedPathOf("kalender")).href)) as {
      default: (request: unknown, response: unknown) => Promise<void>;
    };
    const headers: Record<string, string> = {};
    const response = { statusCode: 0, body: "", setHeader: (name: string, value: string) => void (headers[name] = value), end(body: string) { this.body = body; } };
    await handler({ url: "/api/kalender", headers: { host: "intern.vercel.app", "x-forwarded-host": "lillesandmisjonskirke.menighetsplan.no" } }, response);

    expect(response.statusCode).toBe(200);
    expect(headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.body).toContain("SUMMARY:Gudstjeneste");
    expect(response.body).toContain("URL:https://lillesandmisjonskirke.menighetsplan.no/arrangement/gudstjeneste-1");
  });
});
