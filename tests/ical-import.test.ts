import { describe, expect, test } from "vitest";
import { FEED_MAX_BYTES, externalCalendarIcs, feedAddressRefusal, isInternalAddress, type HttpFetch, type Lookup } from "../server/icalImport";
import type { Fetch } from "../server/firestoreRest";

// The hosting fetches the address an administrator writes in (cms_settings/surfaces). It must
// never be led to an address inside a network: the machine itself, a private net, or the place a
// cloud keeps its keys.

const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.example",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
};

const surfaces = (externalCalendarUrl: string): Fetch => async (url) => ({
  ok: true,
  status: 200,
  json: async () => ({
    name: url,
    fields: {
      recordType: { stringValue: "surfaces" },
      ownWebsite: { booleanValue: false },
      externalCalendarUrl: { stringValue: externalCalendarUrl },
    },
  }),
});

const publicHost: Lookup = async () => ["93.184.216.34"];

const answer = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(status >= 300 && status < 400 ? null : body, { status, headers });

describe("Hvilke adresser kirkens kalender kan hentes fra", () => {
  test("adresser inne i et nett er lukket, og vanlige adresser er åpne", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
      expect(isInternalAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
      expect(isInternalAddress(ip), ip).toBe(false);
    }
  });

  test("navn, tall og porter som leder innover, avvises før noe hentes", async () => {
    for (const url of ["http://localhost/k.ics", "https://127.0.0.1/k.ics", "https://[::1]/k.ics", "http://169.254.169.254/latest/meta-data", "https://tjener.internal/k.ics", "https://kalender.example:8080/k.ics", "https://bruker:passord@kalender.example/k.ics", "file:///etc/passwd", "ftp://kalender.example/k.ics"]) {
      expect(await feedAddressRefusal(url, publicHost), url).not.toBeNull();
    }
    // A name that stands for an inside address is refused too
    expect(await feedAddressRefusal("https://lurt.example/k.ics", async () => ["10.0.0.5"])).not.toBeNull();
    expect(await feedAddressRefusal("https://calendar.google.com/calendar/ical/x/public/basic.ics", publicHost)).toBeNull();
  });

  test("kalenderen hentes fra en vanlig adresse", async () => {
    const asked: string[] = [];
    const httpFetch: HttpFetch = async (url) => {
      asked.push(url);
      return answer(200, "BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    };
    const feed = await externalCalendarIcs({ env, ask: surfaces("https://kalender.example/k.ics"), httpFetch, lookupHost: publicHost });
    expect(feed.status).toBe(200);
    expect(asked).toEqual(["https://kalender.example/k.ics"]);
  });

  test("en adresse inne i nettet hentes aldri, heller ikke når kalenderen sender oss dit", async () => {
    const asked: string[] = [];
    const inside = await externalCalendarIcs({
      env,
      ask: surfaces("http://169.254.169.254/latest/meta-data"),
      httpFetch: async (url) => (asked.push(url), answer(200, "BEGIN:VCALENDAR")),
      lookupHost: publicHost,
    });
    expect(inside.status).toBe(400);

    const redirected = await externalCalendarIcs({
      env,
      ask: surfaces("https://kalender.example/k.ics"),
      httpFetch: async (url) => (asked.push(url), answer(302, "", { Location: "http://127.0.0.1:9001/hemmelig" })),
      lookupHost: publicHost,
    });
    expect(redirected.status).toBe(400);
    expect(asked).toEqual(["https://kalender.example/k.ics"]);
  });

  test("en videresending til en annen vanlig adresse følges, men ikke i det uendelige", async () => {
    let hops = 0;
    const followed = await externalCalendarIcs({
      env,
      ask: surfaces("https://kalender.example/k.ics"),
      httpFetch: async (url) => (url.endsWith("/ny.ics") ? answer(200, "BEGIN:VCALENDAR") : answer(301, "", { Location: "/ny.ics" })),
      lookupHost: publicHost,
    });
    expect(followed.status).toBe(200);

    const circle = await externalCalendarIcs({
      env,
      ask: surfaces("https://kalender.example/k.ics"),
      httpFetch: async () => (hops++, answer(302, "", { Location: "https://kalender.example/k.ics" })),
      lookupHost: publicHost,
    });
    expect(circle.status).toBe(502);
    expect(hops).toBe(4);
  });

  test("en kalender som er for stor, hentes ikke", async () => {
    const feed = await externalCalendarIcs({
      env,
      ask: surfaces("https://kalender.example/k.ics"),
      httpFetch: async () => answer(200, "BEGIN:VCALENDAR", { "Content-Length": String(FEED_MAX_BYTES + 1) }),
      lookupHost: publicHost,
    });
    expect(feed.status).toBe(502);
  });
});
