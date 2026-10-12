// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";
import type { Gathering } from "../src/types";

// An event can have a picture, a lead, a longer text and a link. They are filled in in the
// event's own form, reached from the planner and from «Arrangementer på nettsiden» in the CMS,
// and the picture and the lead are shown on the cards on the front page.

const { planner } = vi.hoisted(() => ({ planner: { gatherings: [] as unknown[] } }));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: { ...demoCmsSettings, churchName: "Menigheten" }, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], groups: [], gatheringsReady: true, ...planner }),
}));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
vi.mock("../src/demo", () => ({ DEMO: null }));

import { CalendarModule } from "../src/components/cms/modules/CalendarModule";
import { WorshipModule } from "../src/components/cms/modules/WorshipModule";
import { GatheringFormDialog } from "../src/components/gathering/GatheringFormDialog";
import { VisibilityTab } from "../src/pages/admin/tabs/VisibilityTab";
import type { StudioData } from "../src/pages/admin/studio";
import { newGatheringForm, type GatheringFormValues } from "../src/utils/gatheringForm";
import { missingOnWebsite, teaserOf } from "../src/utils/gatheringPresentation";

// The part of the form about the website is fetched when it is opened, which takes a moment when every test runs at once
const SLOW = { timeout: 8000 };
const POSTER = "https://menigheten.example/bilder/hostfest.jpg";
const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const event = (id: string, title: string, fields: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "g",
  title,
  startsAt: inAWeek,
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: false,
  ...fields,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  planner.gatherings = [];
});

describe("Hva et arrangement mangler på nettsiden", () => {
  test("bilde og tekst, hver for seg, og en ingress eller en lengre tekst er begge tekst", () => {
    expect(missingOnWebsite(event("a", "Høstfest"))).toEqual(["bilde", "tekst"]);
    expect(missingOnWebsite(event("a", "Høstfest", { imageUrl: POSTER }))).toEqual(["tekst"]);
    expect(missingOnWebsite(event("a", "Høstfest", { summary: "Mat og sang." }))).toEqual(["bilde"]);
    expect(missingOnWebsite(event("a", "Høstfest", { imageUrl: POSTER, content: "## Program" }))).toEqual([]);
  });

  test("et arrangement som ikke vises på nettsiden, mangler ingenting der", () => {
    expect(missingOnWebsite(event("a", "Styremøte", { visibility: "intern" }))).toEqual([]);
    expect(missingOnWebsite(event("a", "Husfellesskap", { type: "gruppesamling" }))).toEqual([]);
  });

  test("linja under tittelen er ingressen, og temaet når ingen ingress er skrevet", () => {
    expect(teaserOf({ summary: "Mat og sang.", theme: "Takk" })).toBe("Mat og sang.");
    expect(teaserOf({ summary: "  ", theme: "Takk" })).toBe("Takk");
    expect(teaserOf({})).toBe("");
  });
});

describe("Delen «På nettsiden» i skjemaet", () => {
  const onSave = vi.fn((_values: GatheringFormValues) => ({ success: true }));
  const show = (start: Partial<GatheringFormValues> = {}, openAt?: "website") =>
    render(
      <GatheringFormDialog
        isNew={false}
        initial={newGatheringForm({ title: "Høstfest", date: "2026-10-18", groupId: "g", ...start })}
        groups={[{ id: "g", name: "Kalender" }]}
        showGroup
        openAt={openAt}
        onSave={onSave}
        onClose={() => {}}
      />
    );

  test("åpnes med knappen, og det som skrives, lagres med arrangementet", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Legg til bilde og tekst" }));

    fireEvent.change(await screen.findByLabelText("Ingress", {}, SLOW), { target: { value: "Mat, sang og lek for hele familien." } });
    fireEvent.change(screen.getByLabelText("Tekst"), { target: { value: "## Program\n\nVi starter kl. 17." } });
    fireEvent.change(screen.getByLabelText("Lenke (valgfritt)"), { target: { value: "https://pamelding.example/host" } });
    fireEvent.change(screen.getByLabelText("Tekst på knappen"), { target: { value: "Meld deg på" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: "Høstfest",
      summary: "Mat, sang og lek for hele familien.",
      content: "## Program\n\nVi starter kl. 17.",
      linkUrl: "https://pamelding.example/host",
      linkLabel: "Meld deg på",
    });
  });

  test("står åpen når arrangementet alt har bilde eller tekst", async () => {
    show({ summary: "Mat og sang." });
    expect(((await screen.findByLabelText("Ingress", {}, SLOW)) as HTMLTextAreaElement).value).toBe("Mat og sang.");
    expect(screen.queryByRole("button", { name: "Legg til bilde og tekst" })).toBeNull();
  });

  test("står åpen, og hentes fram, når skjemaet er åpnet for å fylle den ut", async () => {
    // A browser answers a scroll with a promise. The form must take that, also when it is closed again
    const scrolled = vi.fn(() => Promise.resolve());
    Element.prototype.scrollIntoView = scrolled as unknown as typeof Element.prototype.scrollIntoView;

    const { unmount } = show({}, "website");
    expect(await screen.findByLabelText("Ingress", {}, SLOW)).toBeTruthy();
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
  });

  test("hentes ikke fram når skjemaet er åpnet for noe annet", async () => {
    const scrolled = vi.fn(() => Promise.resolve());
    Element.prototype.scrollIntoView = scrolled as unknown as typeof Element.prototype.scrollIntoView;

    show({ summary: "Mat og sang." });
    expect(await screen.findByLabelText("Ingress", {}, SLOW)).toBeTruthy();
    expect(scrolled).not.toHaveBeenCalled();
  });

  test("en lenke som ikke er en adresse, lagres ikke", async () => {
    show({}, "website");
    fireEvent.change(await screen.findByLabelText("Lenke (valgfritt)", {}, SLOW), { target: { value: "pamelding" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(screen.getByRole("alert").textContent).toBe("Lenken må starte med https:// eller /.");
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("«Arrangementer på nettsiden» i CMS-et", () => {
  const updateGathering = vi.fn((_id: string, _updates: Partial<Gathering>) => ({ success: true }));
  const showFeedback = vi.fn();
  const gatherings = [
    event("a", "Høstfest", { imageUrl: POSTER, summary: "Mat og sang." }),
    event("b", "Gudstjeneste", { isGudstjeneste: true }),
    event("c", "Konsert", { imageUrl: POSTER }),
    event("d", "Styremøte", { visibility: "intern" }),
  ];
  const studio = {
    adminGatherings: gatherings.map((gathering) => ({ gathering })),
    adminGroups: [{ group: { id: "g", name: "Kalender", memberIds: [], leaderIds: [] } }],
    updateGathering,
  } as unknown as StudioData;
  const show = () =>
    render(
      <MemoryRouter>
        <VisibilityTab studio={studio} showFeedback={showFeedback} />
      </MemoryRouter>
    );
  const row = (title: string) => screen.getByRole("heading", { name: title }).closest("div.rounded-2xl") as HTMLElement;

  test("sier med ord hva hvert arrangement mangler, og spør ikke et internt arrangement om noe", () => {
    show();
    expect(screen.getByRole("heading", { name: "Arrangementer på nettsiden" })).toBeTruthy();
    expect(within(row("Høstfest")).getByText("Har bilde og tekst")).toBeTruthy();
    expect(within(row("Gudstjeneste")).getByText("Mangler bilde og tekst")).toBeTruthy();
    expect(within(row("Konsert")).getByText("Mangler tekst")).toBeTruthy();
    expect(within(row("Styremøte")).queryByText(/Mangler|Har bilde/)).toBeNull();
  });

  test("viser bildet til arrangementet som har et", () => {
    show();
    expect(row("Høstfest").querySelector("img")?.getAttribute("src")).toBe(POSTER);
    expect(row("Gudstjeneste").querySelector("img")).toBeNull();
  });

  test("«Bilde og tekst» åpner arrangementets skjema på delen om nettsiden, og lagrer på arrangementet", async () => {
    show();
    fireEvent.click(within(row("Gudstjeneste")).getByRole("button", { name: "Bilde og tekst" }));

    const form = screen.getByRole("dialog", { name: "Rediger arrangement" });
    expect((within(form).getByLabelText("Tittel") as HTMLInputElement).value).toBe("Gudstjeneste");
    fireEvent.change(await within(form).findByLabelText("Ingress", {}, SLOW), { target: { value: "Velkommen til gudstjeneste." } });
    fireEvent.click(within(form).getByRole("button", { name: "Lagre endringer" }));

    expect(updateGathering).toHaveBeenCalledWith("b", expect.objectContaining({ title: "Gudstjeneste", summary: "Velkommen til gudstjeneste.", isGudstjeneste: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(showFeedback).toHaveBeenCalledWith("Arrangementet ble oppdatert!");
  });

  test("synligheten settes som før", () => {
    show();
    fireEvent.click(within(row("Konsert")).getByRole("button", { name: "Fremhev" }));
    expect(updateGathering).toHaveBeenCalledWith("c", { visibility: "fremhevet", isPublic: true });
  });
});

describe("Bildet og ingressen på forsiden", () => {
  test("kortene i «Hva skjer» viser bildet med bildeteksten, og ingressen foran temaet", () => {
    planner.gatherings = [
      event("a", "Høstfest", { imageUrl: POSTER, imageAlt: "Plakat for høstfesten", summary: "Mat og sang.", theme: "Takk" }),
      event("b", "Konsert", { theme: "Lovsang" }),
    ];
    render(
      <MemoryRouter>
        <CalendarModule />
      </MemoryRouter>
    );
    const card = (title: string) => screen.getByRole("heading", { name: title }).closest("a") as HTMLElement;

    expect(within(card("Høstfest")).getByRole("img", { name: "Plakat for høstfesten" }).getAttribute("src")).toBe(POSTER);
    expect(within(card("Høstfest")).getByText("Mat og sang.")).toBeTruthy();
    expect(within(card("Høstfest")).queryByText("Takk")).toBeNull();
    // An event without a picture and a lead is shown as before
    expect(card("Konsert").querySelector("img")).toBeNull();
    expect(within(card("Konsert")).getByText("Lovsang")).toBeTruthy();
    // The whole card opens the event's own page
    expect(card("Høstfest").getAttribute("href")).toBe("/arrangement/a");
  });

  test("«Neste gudstjeneste» viser bildet og ingressen til gudstjenesten", () => {
    planner.gatherings = [event("g", "Gudstjeneste & dåp", { isGudstjeneste: true, imageUrl: POSTER, summary: "Velkommen til gudstjeneste." })];
    render(
      <MemoryRouter>
        <WorshipModule />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Gudstjeneste & dåp" })).toBeTruthy();
    expect(document.querySelector("img")?.getAttribute("src")).toBe(POSTER);
    expect(screen.getByText("Velkommen til gudstjeneste.")).toBeTruthy();
  });

  test("uten bilde tegnes ingen tom ramme", () => {
    planner.gatherings = [event("g", "Gudstjeneste", { isGudstjeneste: true })];
    render(
      <MemoryRouter>
        <WorshipModule />
      </MemoryRouter>
    );
    expect(document.querySelector("img")).toBeNull();
  });
});
