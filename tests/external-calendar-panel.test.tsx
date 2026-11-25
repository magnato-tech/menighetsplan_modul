// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Gathering } from "../src/types";
import { calendarNoteKey, type InstallationSurfaces } from "../src/utils/surfaces";

// The import panel «Fra kirkens kalender» in the Kalender: its four tabs, linking a feed event to a
// planner event, and what «Avvis», «Ta inn likevel» and deleting remember. The hook is the real one;
// the feed, the Firebase writes and the context are replaced.

const { cms, firebase, services } = vi.hoisted(() => ({
  cms: { surfaces: {} as Partial<InstallationSurfaces> },
  firebase: {
    assignments: [] as unknown[],
    getPersonById: (_id: string) => undefined as undefined | { name: string },
    deleteGatheringWithStaffing: vi.fn((_id: string) => ({ success: true }) as { success: boolean; error?: string }),
  },
  services: {
    dismissExternalEvent: vi.fn(async (_uid: string, _note: unknown) => {}),
    restoreExternalUid: vi.fn(async (_uid: string) => {}),
    dismissExternalUid: vi.fn(async (_uid: string) => {}),
    keepExternalUid: vi.fn(async (_uid: string) => {}),
    clearExternalCalendarImportQueue: vi.fn(async () => {}),
    declineExternalChange: vi.fn(async (_uid: string, _values: unknown) => {}),
  },
}));

vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ surfaces: cms.surfaces }) }));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => ({ templates: [], ready: true }) }));
vi.mock("../src/hooks/useLevel", () => ({ useLevel: () => "planner" }));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => firebase }));
vi.mock("../src/services/surfaces", () => services);

import { ExternalCalendarImportPanel } from "../src/components/admin/ExternalCalendarImportPanel";

const sunday = new Date(2026, 10, 8, 11, 0).toISOString();
const sundayFeed = "20261108T110000";

function icsOf(events: { uid?: string; title: string; start: string; cancelled?: boolean }[]): string {
  const blocks = events
    .map((e) =>
      [
        "BEGIN:VEVENT",
        e.uid ? `UID:${e.uid}` : "",
        `DTSTART:${e.start}`,
        `SUMMARY:${e.title}`,
        e.cancelled ? "STATUS:CANCELLED" : "",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
  return `BEGIN:VCALENDAR\n${blocks}\nEND:VCALENDAR`;
}

let feedText = "";
const showFeedback = vi.fn();
let gatherings: Gathering[] = [];
const updateGathering = vi.fn((_id: string, _patch: Partial<Gathering>) => ({ success: true }) as { success: boolean; error?: string });

function gathering(overrides: Partial<Gathering> & { id: string }): Gathering {
  return { groupId: "grp", title: "Gudstjeneste", startsAt: sunday, visibility: "offentlig", ...overrides } as Gathering;
}

function studioFor(list: Gathering[]) {
  return {
    adminGatherings: list.map((g) => ({ gathering: g, tasks: [] })),
    adminGroups: [{ group: { id: "grp", name: "Gudstjenesten", memberIds: [], leaderIds: [], deputyLeaderIds: [] } }],
    adminVolunteerRoles: [],
    updateGathering,
  } as unknown as Parameters<typeof ExternalCalendarImportPanel>[0]["studio"];
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <ExternalCalendarImportPanel studio={studioFor(gatherings)} showFeedback={showFeedback} />
    </MemoryRouter>
  );
}

async function tab(name: RegExp) {
  return waitFor(() => {
    const found = screen.getByRole("tab", { name });
    return found;
  });
}

beforeEach(() => {
  cms.surfaces = {
    minSide: true,
    ownWebsite: false,
    externalSiteUrl: "",
    signInBackUrl: "",
    externalCalendarUrl: "https://calendar.example.org/basic.ics",
    importNewAutomatically: false,
    dismissedUids: [],
    keptUids: [],
    calendarNotes: {},
  };
  gatherings = [];
  feedText = "";
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => feedText })));
  updateGathering.mockClear();
  updateGathering.mockImplementation(() => ({ success: true }));
  showFeedback.mockClear();
  Object.values(services).forEach((fn) => fn.mockClear());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Fra kirkens kalender: faner", () => {
  test("fire faner med antall, og Venter teller nye rader", async () => {
    feedText = icsOf([
      { uid: "uid-a", title: "Gudstjeneste", start: sundayFeed },
      { uid: "uid-b", title: "Bønnemøte", start: "20261109T190000" },
      { uid: "uid-linked", title: "Kaffe", start: "20261110T100000" },
    ]);
    gatherings = [gathering({ id: "kaffe", title: "Kaffe", startsAt: new Date(2026, 10, 10, 10, 0).toISOString(), externalCalendarUid: "uid-linked" })];
    renderPanel();

    await tab(/Venter \(2\)/);
    expect(screen.getByRole("tab", { name: /Lagt inn \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Endret \(0\)/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Avvist og slettet \(0\)/ })).toBeTruthy();
  });

  test("Lagt inn viser koblede hendelser med en lenke til arrangementet", async () => {
    feedText = icsOf([{ uid: "uid-linked", title: "Kaffe", start: "20261110T100000" }]);
    gatherings = [gathering({ id: "kaffe", title: "Kaffe", startsAt: new Date(2026, 10, 10, 10, 0).toISOString(), externalCalendarUid: "uid-linked" })];
    renderPanel();

    fireEvent.click(await tab(/Lagt inn \(1\)/));
    const link = screen.getByRole("link", { name: "Åpne" });
    expect(link.getAttribute("href")).toBe("/admin/samling/kaffe");
  });
});

describe("Fra kirkens kalender: koble", () => {
  test("Koble på en rad setter bare externalCalendarUid", async () => {
    feedText = icsOf([{ uid: "uid-gud", title: "Gudstjeneste", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste" })];
    renderPanel();

    expect(await screen.findByText(/Ligner på: Gudstjeneste/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Koble" }));
    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    expect(updateGathering).toHaveBeenCalledWith("g1", { externalCalendarUid: "uid-gud" });
    expect(showFeedback).toHaveBeenLastCalledWith(expect.stringMatching(/^Koblet: Gudstjeneste /));
  });

  test("en hendelse uten ID i kalenderen kan ikke kobles", async () => {
    feedText = icsOf([{ title: "Gudstjeneste ute", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste" })];
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Koble" }));
    expect(updateGathering).not.toHaveBeenCalled();
    expect(showFeedback).toHaveBeenLastCalledWith("Kan ikke kobles: hendelsen mangler ID i kalenderen.", "error");
  });

  test("Koble alle forslag: avhaking av en rad kobler bare de andre", async () => {
    feedText = icsOf([
      { uid: "uid-1", title: "Gudstjeneste", start: sundayFeed },
      { uid: "uid-2", title: "Bønnemøte", start: "20261109T190000" },
    ]);
    gatherings = [
      gathering({ id: "g1", title: "Gudstjeneste" }),
      gathering({ id: "g2", title: "Bønnemøte", startsAt: new Date(2026, 10, 9, 19, 0).toISOString() }),
    ];
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Koble alle forslag \(2\)/ }));
    const review = screen.getByRole("region", { name: "Koble alle forslag" });
    const boxes = within(review).getAllByRole("checkbox");
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(boxes[1]);

    fireEvent.click(within(review).getByRole("button", { name: "Koble valgte (1)" }));
    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    expect(updateGathering).toHaveBeenCalledWith("g1", { externalCalendarUid: "uid-1" });
    expect(screen.queryByRole("region", { name: "Koble alle forslag" })).toBeNull();
  });
});

describe("Fra kirkens kalender: avvise og slette", () => {
  test("Avvis husker valget med en note", async () => {
    feedText = icsOf([{ uid: "uid-x", title: "Avvis-prøve", start: "20261109T190000" }]);
    renderPanel();

    // Wait for this feed's row: the panel may first show the last diff of an earlier test
    await screen.findByText("Avvis-prøve");
    fireEvent.click(screen.getByRole("button", { name: "Avvis" }));
    await waitFor(() => expect(services.dismissExternalEvent).toHaveBeenCalledTimes(1));
    const [uid, note] = services.dismissExternalEvent.mock.calls[0] as unknown as [string, { reason: string; title: string; startsAt: string; at: string }];
    expect(uid).toBe("uid-x");
    expect(note.reason).toBe("avvist");
    expect(note.title).toBe("Avvis-prøve");
    expect(typeof note.at).toBe("string");
  });

  test("Ta inn likevel fjerner avvisningen og notatet", async () => {
    feedText = icsOf([{ uid: "uid-slettet", title: "Kaffe", start: "20261110T100000" }]);
    cms.surfaces = {
      ...cms.surfaces,
      dismissedUids: ["uid-slettet"],
      calendarNotes: {
        [calendarNoteKey("uid-slettet")]: { reason: "slettet", at: sunday, title: "Kaffe", startsAt: sunday },
      },
    };
    renderPanel();

    fireEvent.click(await tab(/Avvist og slettet \(1\)/));
    expect(screen.getByText(/^Slettet /)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ta inn likevel" }));
    await waitFor(() => expect(services.restoreExternalUid).toHaveBeenCalledWith("uid-slettet"));
  });
});

// Google's changes are suggestions: «Endret» shows them, and only a click writes them.
describe("Fra kirkens kalender: endringer er forslag", () => {
  const laterSunday = new Date(2026, 10, 8, 12, 0).toISOString();

  test("synkronisering skriver aldri en endring fra kalenderen inn i et koblet arrangement", async () => {
    feedText = icsOf([{ uid: "uid-c", title: "Gudstjeneste", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste & dåp", externalCalendarUid: "uid-c" })];
    renderPanel();

    fireEvent.click(await tab(/Endret \(1\)/));
    expect(updateGathering).not.toHaveBeenCalled();
  });

  test("Oppdater skriver bare tittelen når bare tittelen er forskjellig", async () => {
    feedText = icsOf([{ uid: "uid-t", title: "Gudstjeneste", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste & dåp", externalCalendarUid: "uid-t" })];
    renderPanel();

    fireEvent.click(await tab(/Endret \(1\)/));
    expect(screen.getByText(/Tittel: Google «Gudstjeneste» · appen «Gudstjeneste & dåp»/)).toBeTruthy();
    const rowButtons = screen.getAllByRole("button", { name: "Oppdater" });
    fireEvent.click(rowButtons.at(-1)!);
    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    expect(updateGathering.mock.calls[0]).toStrictEqual(["g1", { title: "Gudstjeneste" }]);
  });

  test("Oppdater skriver bare tiden når bare tiden er forskjellig", async () => {
    feedText = icsOf([{ uid: "uid-u", title: "Gudstjeneste", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste", startsAt: laterSunday, externalCalendarUid: "uid-u" })];
    renderPanel();

    fireEvent.click(await tab(/Endret \(1\)/));
    expect(screen.getByText("Tid: Google 11:00 · appen 12:00")).toBeTruthy();
    const rowButtons = screen.getAllByRole("button", { name: "Oppdater" });
    fireEvent.click(rowButtons.at(-1)!);
    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    expect(updateGathering.mock.calls[0]).toStrictEqual(["g1", { startsAt: sunday }]);
  });

  test("«La være» skjuler raden og husker Googles verdier", async () => {
    feedText = icsOf([{ uid: "uid-d", title: "Gudstjeneste i kirken", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste", externalCalendarUid: "uid-d" })];
    renderPanel();

    fireEvent.click(await tab(/Endret \(1\)/));
    fireEvent.click(screen.getByRole("button", { name: "La være" }));
    await waitFor(() => expect(services.declineExternalChange).toHaveBeenCalledTimes(1));
    expect(services.declineExternalChange.mock.calls[0]).toStrictEqual([
      "uid-d",
      { title: "Gudstjeneste i kirken", startsAt: sunday, location: "", cancelled: false },
    ]);
    fireEvent.click(await tab(/Endret \(0\)/));
    expect(updateGathering).not.toHaveBeenCalled();
  });

  test("når Google endrer seg igjen etter «La være», kommer raden tilbake", async () => {
    feedText = icsOf([{ uid: "uid-d", title: "Gudstjeneste i kirken", start: sundayFeed }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste", externalCalendarUid: "uid-d" })];
    cms.surfaces = {
      ...cms.surfaces,
      calendarDeclined: {
        [calendarNoteKey("uid-d")]: { title: "Gudstjeneste i kirken", startsAt: sunday, location: "", cancelled: false },
      },
    };
    renderPanel();

    fireEvent.click(await tab(/Endret \(0\)/));
    feedText = icsOf([{ uid: "uid-d", title: "Gudstjeneste i kirkesalen", start: sundayFeed }]);
    fireEvent.click(screen.getAllByRole("button", { name: "Oppdater" })[0]);
    fireEvent.click(await tab(/Endret \(1\)/));
    expect(screen.getByText(/Gudstjeneste i kirkesalen/)).toBeTruthy();
  });

  test("avlyst i kalenderen er et forslag: «Avlys her også» skriver bare avlyst", async () => {
    feedText = icsOf([{ uid: "uid-k", title: "Gudstjeneste", start: sundayFeed, cancelled: true }]);
    gatherings = [gathering({ id: "g1", title: "Gudstjeneste", externalCalendarUid: "uid-k" })];
    renderPanel();

    fireEvent.click(await tab(/Endret \(1\)/));
    expect(screen.getByText("Avlyst i kirkens kalender")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Avlys her også" }));
    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    expect(updateGathering.mock.calls[0]).toStrictEqual(["g1", { cancelled: true }]);
  });

  test("«Oppdater alle» viser en gjennomgang der en rad kan fjernes", async () => {
    feedText = icsOf([
      { uid: "uid-1", title: "Gudstjeneste", start: sundayFeed },
      { uid: "uid-2", title: "Bønnemøte", start: "20261109T190000" },
    ]);
    gatherings = [
      gathering({ id: "g1", title: "Gudstjeneste & dåp", externalCalendarUid: "uid-1" }),
      gathering({ id: "g2", title: "Bønnemøte & kaffe", startsAt: new Date(2026, 10, 9, 19, 0).toISOString(), externalCalendarUid: "uid-2" }),
    ];
    renderPanel();

    fireEvent.click(await tab(/Endret \(2\)/));
    fireEvent.click(await screen.findByRole("button", { name: /Oppdater alle \(2\)/ }));
    const review = screen.getByRole("region", { name: "Oppdater alle" });
    const boxes = within(review).getAllByRole("checkbox");
    fireEvent.click(boxes[1]);
    fireEvent.click(within(review).getByRole("button", { name: "Oppdater valgte (1)" }));

    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    expect(updateGathering.mock.calls[0]).toStrictEqual(["g1", { title: "Gudstjeneste" }]);
    expect(screen.queryByRole("region", { name: "Oppdater alle" })).toBeNull();
  });
});
