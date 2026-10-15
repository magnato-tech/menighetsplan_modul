// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NEWSLETTER_BANNER_DOCUMENT as SENDING_BANNER_DOCUMENT, NEWSLETTER_BANNER_RECORD as SENDING_BANNER_RECORD, NEWSLETTER_OPT_OUTS, PERSONS, SEND_URL, sendEmail } from "../server/emailSending";
import { NEWSLETTER_BANNER_DOCUMENT, newsletterBanner } from "../server/newsletterBanner";
import type { Fetch, RestFields, RestValue } from "../server/firestoreRest";
import { CMS_COLLECTIONS, NEWSLETTER_OPT_OUTS_COLLECTION } from "../src/data/collections";
import { NEWSLETTER_BANNER_DOC_ID, NEWSLETTER_BANNER_RECORD } from "../src/data/settingsRecords";
import { EMAIL_TEMPLATES, emailBlocksOf, emailDraftError, inlineHtml, inlineText, renderEmail } from "../src/utils/emailMessage";
import { audienceLabel, emailRecipients, isNewsletter, toEmailAudience } from "../src/utils/emailRecipients";
import { linkAddressOf, makeBold, makeLink, toggleHeading, toggleList } from "../src/utils/emailToolbar";
import {
  NEWSLETTER_BANNER_PATH,
  TEST_UNSUBSCRIBE_TOKEN,
  isNewsletterToken,
  newNewsletterToken,
  newsletterBannerOf,
  newsletterBannerUrlOf,
  optedOutPersonIds,
  unsubscribeUrlOf,
} from "../src/utils/newsletter";
import { isPublicPath, isUnsubscribePath } from "../src/utils/routes";
import type { Group, Person } from "../src/types";

// The newsletter: to the members, or to everyone in the register, with a banner and a link to
// unsubscribe. Every person here is made up.

const KEY_KARI = "kariKariKariKariKariKariKariKari";
const KEY_ELSE = "elseElseElseElseElseElseElseElse";

const person = (id: string, name: string, email: string | undefined, more: Partial<Person> = {}): Person => ({ id, name, email, globalRole: "member", ...more });
const persons: Person[] = [
  person("admin", "Astrid Admin", "astrid@example.org", { globalRole: "admin", congregationMember: true }),
  person("kari", "Kari Medlem", "kari@example.org", { congregationMember: true, newsletterToken: KEY_KARI }),
  person("ola", "Ola Medlem", "ola@example.org", { congregationMember: true }),
  person("venn", "Vera Venn", "vera@example.org"),
  person("uten", "Ulf Uten", undefined, { congregationMember: true }),
  person("ektefelle-1", "Else Delt", "familien@example.org", { congregationMember: true, newsletterToken: KEY_ELSE }),
  person("ektefelle-2", "Erik Delt", "familien@example.org"),
];
const groups: Group[] = [{ id: "lyd", name: "Lyd", category: "tjenestegruppe", leaderIds: ["kari"], memberIds: ["ola"], deputyLeaderIds: [] }];

describe("Hvem nyhetsbrevet går til", () => {
  test("medlemmene er de som er merket som medlem av menigheten; alle er hele registeret med e-post", () => {
    expect(emailRecipients({ kind: "members" }, persons, groups).recipients.map((one) => one.email)).toEqual(["astrid@example.org", "familien@example.org", "kari@example.org", "ola@example.org"]);
    const everyone = emailRecipients({ kind: "everyone" }, persons, groups);
    expect(everyone.recipients.map((one) => one.email)).toEqual(["astrid@example.org", "familien@example.org", "kari@example.org", "ola@example.org", "vera@example.org"]);
    expect(everyone.withoutEmail.map((one) => one.id)).toEqual(["uten"]);
  });

  test("den som har meldt seg av, får ikke nyhetsbrevet, og en delt adresse regnes som meldt av når én på den har gjort det", () => {
    const off = optedOutPersonIds(persons, [KEY_ELSE, "ukjentukjentukjentukjentukjentuk"]);
    expect([...off]).toEqual(["ektefelle-1"]);
    const { recipients, optedOut } = emailRecipients({ kind: "everyone" }, persons, groups, undefined, off);
    expect(recipients.map((one) => one.email)).not.toContain("familien@example.org");
    expect(optedOut.map((one) => one.id)).toEqual(["ektefelle-1", "ektefelle-2"]);
  });

  test("avmeldingen gjelder bare nyhetsbrevet: en beskjed til en gruppe går ut som før", () => {
    const off = optedOutPersonIds(persons, [KEY_KARI]);
    const group = emailRecipients({ kind: "group", groupId: "lyd" }, persons, groups, undefined, off);
    expect(group.recipients.map((one) => one.email)).toEqual(["kari@example.org", "ola@example.org"]);
    expect(group.optedOut).toEqual([]);
  });

  test("nyhetsbrevets mottakere leses og navngis", () => {
    expect(toEmailAudience({ kind: "members" })).toEqual({ kind: "members" });
    expect(toEmailAudience({ kind: "everyone", groupId: "x" })).toEqual({ kind: "everyone" });
    expect(isNewsletter({ kind: "members" }) && isNewsletter({ kind: "everyone" })).toBe(true);
    expect(isNewsletter({ kind: "leaders" }) || isNewsletter({ kind: "group", groupId: "lyd" })).toBe(false);
    expect(audienceLabel({ kind: "members" }, groups)).toBe("Nyhetsbrev: medlemmer av menigheten");
    expect(audienceLabel({ kind: "everyone" }, groups)).toBe("Nyhetsbrev: alle i registeret med e-post");
  });
});

describe("Teksten med overskrifter, fet skrift, lenker og punktlister", () => {
  test("teksten deles i overskrifter, avsnitt og lister", () => {
    expect(emailBlocksOf("## Hva skjer\nFørste linje\nAndre linje\n\n- Ett\n- To\nEtter lista\n\n\n## Slutt")).toEqual([
      { kind: "heading", text: "Hva skjer" },
      { kind: "paragraph", lines: ["Første linje", "Andre linje"] },
      { kind: "list", items: ["Ett", "To"] },
      { kind: "paragraph", lines: ["Etter lista"] },
      { kind: "heading", text: "Slutt" },
    ]);
  });

  test("fet skrift og lenker blir HTML, alt annet forblir tekst", () => {
    expect(inlineHtml("Se **her** og [nettsiden](https://menigheten.example/hva-skjer?a=1&b=2)")).toBe(
      'Se <strong>her</strong> og <a href="https://menigheten.example/hva-skjer?a=1&amp;b=2" style="color:#047857;text-decoration:underline;">nettsiden</a>'
    );
    expect(inlineHtml("[e-post](mailto:post@example.org)")).toContain('href="mailto:post@example.org"');
    // Only web and e-mail addresses become links, and nothing written is read as HTML
    expect(inlineHtml("[klikk](javascript:alert(1))")).toBe("[klikk](javascript:alert(1))");
    expect(inlineHtml('<img src=x onerror="x">')).toBe("&lt;img src=x onerror=&quot;x&quot;&gt;");
    expect(inlineHtml('[<b>x</b>](https://a.example/"onmouseover=")')).not.toMatch(/<b>|href="[^"]*"onmouseover/);
    expect(inlineText("Se **her** og [nettsiden](https://m.example) eller [skriv](mailto:post@example.org)")).toBe("Se her og nettsiden (https://m.example) eller skriv (post@example.org)");
  });

  test("teksten kan være lang nok til et nyhetsbrev, og nyhetsbrevet trenger ingen knapp", () => {
    const newsletter = EMAIL_TEMPLATES.find((template) => template.id === "nyhetsbrev")!;
    expect(emailDraftError(newsletter)).toBeNull();
    expect(emailDraftError({ ...newsletter, text: "x".repeat(9000) })).toBeNull();
    expect(emailDraftError({ ...newsletter, text: "x".repeat(10001) })).toMatch(/lengre enn 10000/);
  });
});

describe("Nyhetsbrevet slik det ser ut", () => {
  const draft = { subject: "Nyhetsbrev oktober", text: "## Kjære alle!\n\nVelkommen til **høstfest**.\n\n- Søndag\n- Onsdag", link: "ingen" as const };
  const newsletter = { unsubscribeUrl: "https://menigheten.example/avmelding/" + KEY_KARI, bannerUrl: "https://menigheten.example/api/nyhetsbrevbilde?v=1" };

  test("toppbildet øverst, ingen hilsen eller knapp, og en lenke for å melde seg av nederst", () => {
    const mail = renderEmail({ draft, churchName: "Fjellbygda menighet", siteUrl: "https://menigheten.example", firstName: "Kari", newsletter });
    expect(mail.html).toContain('<img src="https://menigheten.example/api/nyhetsbrevbilde?v=1" alt="Fjellbygda menighet"');
    expect(mail.html).toContain("<h2");
    expect(mail.html).toContain("<strong>høstfest</strong>");
    expect(mail.html).toContain("<li style=\"margin:4px 0;\">Søndag</li>");
    expect(mail.html).toContain(`href="${newsletter.unsubscribeUrl}"`);
    expect(mail.html).not.toContain("Hei Kari");
    expect(mail.html).not.toContain("Hilsen");
    expect(mail.html).not.toContain("Åpne Min side");
    expect(mail.text).toBe(`KJÆRE ALLE!\n\nVelkommen til høstfest.\n\n- Søndag\n- Onsdag\n\nDu får dette nyhetsbrevet fra Fjellbygda menighet. Meld deg av: ${newsletter.unsubscribeUrl}`);
  });

  test("uten toppbilde står menighetens navn der, og en knapp kan legges til", () => {
    const mail = renderEmail({ draft: { ...draft, link: "minside" }, churchName: "Fjellbygda menighet", siteUrl: "https://menigheten.example", firstName: null, newsletter: { ...newsletter, bannerUrl: null } });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain(">Fjellbygda menighet</td>");
    expect(mail.html).toContain('href="https://menigheten.example/minside"');
  });
});

describe("Knappene over teksten", () => {
  test("overskrift og punktliste gjelder hele linjene som er merket, og et nytt trykk tar dem bort", () => {
    const text = "Første\nAndre\nTredje";
    const heading = toggleHeading({ text, start: 2, end: 2 });
    expect(heading.text).toBe("## Første\nAndre\nTredje");
    expect(toggleHeading({ text: heading.text, start: 3, end: 3 }).text).toBe(text);
    const list = toggleList({ text, start: 8, end: 15 });
    expect(list.text).toBe("Første\n- Andre\n- Tredje");
    expect(toggleList({ text: list.text, start: list.start, end: list.end }).text).toBe(text);
  });

  test("fet skrift og lenke legges rundt det som er merket", () => {
    expect(makeBold({ text: "Kom på fest", start: 7, end: 11 })).toEqual({ text: "Kom på **fest**", start: 9, end: 13 });
    expect(makeBold({ text: "", start: 0, end: 0 }).text).toBe("**fet tekst**");
    expect(makeLink({ text: "Les mer her", start: 4, end: 11 }, "https://m.example").text).toBe("Les [mer her](https://m.example)");
    expect(makeLink({ text: "", start: 0, end: 0 }, "mailto:post@example.org").text).toBe("[post@example.org](mailto:post@example.org)");
  });

  test("adressen til en lenke skrives slik man er vant til", () => {
    expect(linkAddressOf("www.menigheten.no")).toBe("https://www.menigheten.no");
    expect(linkAddressOf("https://menigheten.no/side")).toBe("https://menigheten.no/side");
    expect(linkAddressOf("post@menigheten.no")).toBe("mailto:post@menigheten.no");
    for (const wrong of ["", "hei", "javascript:alert(1)", "to ord.no", "a)b.no"]) expect(linkAddressOf(wrong)).toBeNull();
  });
});

describe("Nøkkelen og toppbildet", () => {
  test("en nøkkel er 32 tegn, laget av tilfeldige tall", () => {
    const key = newNewsletterToken();
    expect(isNewsletterToken(key)).toBe(true);
    expect(newNewsletterToken()).not.toBe(key);
    expect(isNewsletterToken(TEST_UNSUBSCRIBE_TOKEN)).toBe(false);
    expect(unsubscribeUrlOf("https://m.example/", KEY_KARI)).toBe(`https://m.example/avmelding/${KEY_KARI}`);
  });

  test("toppbildet leses uten å stole på det som er lagret", () => {
    expect(newsletterBannerOf("data:image/jpeg;base64,AAAA")).toEqual({ kind: "stored", contentType: "image/jpeg", base64: "AAAA" });
    expect(newsletterBannerOf("/bildebibliotek/kirke.jpg")).toEqual({ kind: "address", url: "/bildebibliotek/kirke.jpg" });
    expect(newsletterBannerOf("https://bilder.example/topp.png")).toEqual({ kind: "address", url: "https://bilder.example/topp.png" });
    for (const wrong of ["data:text/html;base64,AAAA", "http://usikker.example/a.png", "//annen.example/a.png", "javascript:x", 7, null]) expect(newsletterBannerOf(wrong)).toBeNull();
    expect(newsletterBannerUrlOf("https://m.example", "2026-10-15T10:00:00.000Z")).toBe(`https://m.example${NEWSLETTER_BANNER_PATH}?v=2026-10-15T10%3A00%3A00.000Z`);
  });

  test("navnene på serveren er de samme som appen bruker", () => {
    expect(NEWSLETTER_BANNER_DOCUMENT).toBe(`${CMS_COLLECTIONS.SETTINGS}/${NEWSLETTER_BANNER_DOC_ID}`);
    expect(SENDING_BANNER_DOCUMENT).toBe(NEWSLETTER_BANNER_DOCUMENT);
    expect(SENDING_BANNER_RECORD).toBe(NEWSLETTER_BANNER_RECORD);
    expect(NEWSLETTER_OPT_OUTS).toBe(NEWSLETTER_OPT_OUTS_COLLECTION);
  });

  test("avmeldingssiden er ikke en del av nettsiden", () => {
    expect(isUnsubscribePath(`/avmelding/${KEY_KARI}`)).toBe(true);
    expect(isPublicPath(`/avmelding/${KEY_KARI}`)).toBe(false);
    expect(isUnsubscribePath("/avmeldingsskjema")).toBe(false);
  });
});

// ---------- Where the e-mail is sent ----------

const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
  RESEND_API_KEY: "re_hemmelig",
};
const tokenFor = (email: string) => `hode.${Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url")}.signatur`;
const encode = (value: unknown): RestValue => {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { nullValue: null };
};
const fieldsOf = (data: object): RestFields => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encode(value)]));
const rowsOf = (collection: string, items: { id: string }[]) => items.map((item) => ({ document: { name: `projects/menigheten/databases/(default)/documents/${collection}/${item.id}`, fields: fieldsOf(item) } }));

interface Mail {
  to: string[];
  html: string;
  text: string;
  headers?: Record<string, string>;
}

/** A database and an e-mail service that remember what they were asked. */
const world = ({ optOuts = [] as string[], refuseOptOuts = 0, banner = null as string | null } = {}) => {
  const commits: { writes: { update: { name: string; fields: RestFields }; updateMask: { fieldPaths: string[] } }[] }[] = [];
  const mails: Mail[][] = [];
  const ask: Fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    if (url === SEND_URL) {
      mails.push(body);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (url.endsWith(":commit")) {
      commits.push(body);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (url.endsWith(":runQuery")) {
      const collection = body.structuredQuery.from[0].collectionId as string;
      if (collection === NEWSLETTER_OPT_OUTS) {
        if (refuseOptOuts) return { ok: false, status: refuseOptOuts, json: async () => [] };
        return { ok: true, status: 200, json: async () => rowsOf(collection, optOuts.map((id) => ({ id, at: "2026-10-15" }))) };
      }
      return { ok: true, status: 200, json: async () => rowsOf(collection, collection === PERSONS ? persons : groups) };
    }
    if (url.endsWith("/cms_settings/email")) return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ recordType: "email", replyTo: "post@example.org" }) }) };
    if (url.endsWith(`/${SENDING_BANNER_DOCUMENT}`))
      return banner ? { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ recordType: "newsletterBanner", imageUrl: banner, updatedAt: "v7" }) }) } : { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ churchName: "Fjellbygda menighet" }) }) };
  };
  const sent = () => mails.flat();
  return { ask, commits, mails, sent };
};
const draft = { subject: "Nyhetsbrev", text: "## Hei alle\n\nNytt fra oss.", link: "ingen" };
const send = (place: ReturnType<typeof world>, body: object) =>
  sendEmail({ env, siteUrl: "https://menigheten.example", idToken: tokenFor("astrid@example.org"), body, ask: place.ask, wait: async () => undefined });

describe("Utsendingen av nyhetsbrevet", () => {
  beforeEach(() => vi.stubGlobal("console", { ...console, error: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());

  test("hver mottaker får sin egen lenke for å melde seg av, og de som mangler nøkkel, får en før noe sendes", async () => {
    const place = world({ banner: "data:image/png;base64,AAAA" });
    const { body } = await send(place, { ...draft, mode: "send", audience: { kind: "members" } });
    expect(body).toMatchObject({ ok: true, sent: 4 });

    // Kari and the shared address keep the keys they have; Astrid and Ola get new ones, in one write
    expect(place.commits).toHaveLength(1);
    const written = place.commits[0].writes.map((write) => [write.update.name.split("/documents/")[1], write.updateMask.fieldPaths]);
    expect(written).toEqual([
      ["persons/admin", ["newsletterToken"]],
      ["persons/ola", ["newsletterToken"]],
    ]);
    const olaKey = place.commits[0].writes[1].update.fields.newsletterToken.stringValue as string;
    expect(isNewsletterToken(olaKey)).toBe(true);

    const byAddress = new Map(place.sent().map((mail) => [mail.to[0], mail]));
    expect(byAddress.get("kari@example.org")!.html).toContain(`https://menigheten.example/avmelding/${KEY_KARI}`);
    expect(byAddress.get("kari@example.org")!.headers).toEqual({ "List-Unsubscribe": `<https://menigheten.example/avmelding/${KEY_KARI}>` });
    expect(byAddress.get("familien@example.org")!.html).toContain(`/avmelding/${KEY_ELSE}`);
    expect(byAddress.get("ola@example.org")!.text).toContain(`Meld deg av: https://menigheten.example/avmelding/${olaKey}`);
    expect(byAddress.get("ola@example.org")!.html).toContain('src="https://menigheten.example/api/nyhetsbrevbilde?v=v7"');
  });

  test("den som har meldt seg av, får ingenting", async () => {
    const place = world({ optOuts: [KEY_KARI] });
    await send(place, { ...draft, mode: "send", audience: { kind: "everyone" } });
    expect(place.sent().map((mail) => mail.to[0])).not.toContain("kari@example.org");
    expect(place.sent().map((mail) => mail.to[0])).toContain("vera@example.org");
  });

  test("med reglene fra før nyhetsbrevet sendes ingenting, og det sies hvorfor", async () => {
    const place = world({ refuseOptOuts: 403 });
    const { body } = await send(place, { ...draft, mode: "send", audience: { kind: "members" } });
    expect(body).toMatchObject({ ok: false, reason: "rules-outdated" });
    expect(place.mails).toEqual([]);
    expect(place.commits).toEqual([]);
  });

  test("prøven ser ut som nyhetsbrevet, med en lenke som ikke melder noen av", async () => {
    const place = world();
    const { body } = await send(place, { ...draft, mode: "test", audience: { kind: "members" } });
    expect(body).toMatchObject({ ok: true, mode: "test", sent: 1 });
    expect(place.sent()[0].to).toEqual(["astrid@example.org"]);
    expect(place.sent()[0].html).toContain(`/avmelding/${TEST_UNSUBSCRIBE_TOKEN}`);
    expect(place.commits).toEqual([]);
  });

  test("en beskjed til en gruppe har verken avmelding eller toppbilde", async () => {
    const place = world({ banner: "data:image/png;base64,AAAA" });
    await send(place, { ...draft, link: "minside", mode: "send", audience: { kind: "group", groupId: "lyd" } });
    expect(place.sent().every((mail) => !mail.html.includes("avmelding") && !mail.headers && !mail.html.includes("<img"))).toBe(true);
    expect(place.commits).toEqual([]);
  });
});

describe("Toppbildet der installasjonen kjører", () => {
  const banner = (imageUrl: string | null) => {
    const ask: Fetch = async (url, init) => {
      expect(init?.headers?.Authorization).toBeUndefined();
      expect(url.endsWith(`/${NEWSLETTER_BANNER_DOCUMENT}`)).toBe(true);
      return imageUrl ? { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ recordType: "newsletterBanner", imageUrl }) }) } : { ok: false, status: 404, json: async () => ({}) };
    };
    return newsletterBanner({ env, siteUrl: "https://menigheten.example", ask });
  };

  test("et opplastet bilde sendes som bilde, et fra biblioteket sendes videre til adressen sin, og uten bilde svares det at det mangler", async () => {
    const stored = await banner(`data:image/png;base64,${Buffer.from("bildet").toString("base64")}`);
    expect(stored.status).toBe(200);
    expect(stored.headers["Content-Type"]).toBe("image/png");
    expect((stored.body as Buffer).toString()).toBe("bildet");

    const library = await banner("/bildebibliotek/kirke.jpg");
    expect(library).toMatchObject({ status: 302, headers: { Location: "https://menigheten.example/bildebibliotek/kirke.jpg" } });

    expect((await banner(null)).status).toBe(404);
    expect((await banner("data:text/html;base64,AAAA")).status).toBe(404);
  });
});

// ---------- The unsubscribe page ----------

const store = vi.hoisted(() => ({ already: false, optOut: vi.fn(async (_key: string) => undefined) }));
vi.mock("../src/services/newsletter", () => ({
  isOptedOut: async () => store.already,
  optOut: store.optOut,
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Fjellbygda menighet" } }) }));

import { UnsubscribePage } from "../src/pages/UnsubscribePage";

describe("Siden lenken fører til", () => {
  const open = (key: string) =>
    render(
      <MemoryRouter initialEntries={[`/avmelding/${key}`]}>
        <Routes>
          <Route path="/avmelding/:key" element={<UnsubscribePage />} />
        </Routes>
      </MemoryRouter>
    );

  beforeEach(() => {
    store.already = false;
    store.optOut.mockClear();
  });
  afterEach(cleanup);

  test("ingenting skjer før knappen trykkes; så er man meldt av", async () => {
    open(KEY_KARI);
    const button = await screen.findByRole("button", { name: "Meld meg av" });
    expect(store.optOut).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(document.getElementById("unsubscribe-done")).toBeTruthy());
    expect(store.optOut).toHaveBeenCalledWith(KEY_KARI);
    expect(screen.getByRole("heading").textContent).toBe("Du er meldt av");
  });

  test("den som alt er meldt av, får vite det", async () => {
    store.already = true;
    open(KEY_KARI);
    await waitFor(() => expect(document.getElementById("unsubscribe-done")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Meld meg av" })).toBeNull();
  });

  test("lenken fra en prøve og en lenke som ikke er hel, melder ingen av", () => {
    open(TEST_UNSUBSCRIBE_TOKEN);
    expect(screen.getByText(/kom i en prøve/)).toBeTruthy();
    cleanup();
    open("kort");
    expect(screen.getByText(/Lenken er ikke hel/)).toBeTruthy();
    expect(store.optOut).not.toHaveBeenCalled();
  });
});
