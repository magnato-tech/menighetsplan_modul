// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CmsSermon } from "../src/data/cmsData";
import { filterSermons, sermonFilterOptions, sermonSpeakerOf } from "../src/utils/sermonFilter";

const sermon = (over: Partial<CmsSermon> & Pick<CmsSermon, "id" | "title" | "speaker" | "date">): CmsSermon => ({ ...over });

const SERMONS: CmsSermon[] = [
  sermon({ id: "a", title: "Guds rike er nær", speaker: "Pastor Kari Nordmann", date: "2026-08-30T11:00:00.000Z", bibleText: "Markus 1,14–15", series: "Vandring gjennom Markus" }),
  sermon({ id: "b", title: "Kalt til å følge", speaker: "Gjesteleder Thomas Vik", date: "2026-08-23T11:00:00.000Z", bibleText: "Markus 1,16–20", series: "Vandring gjennom Markus" }),
  sermon({ id: "c", title: "Nåde og tilgivelse", speaker: "Ødegård Ruth", date: "2025-12-24T11:00:00.000Z", bibleText: "Lukas 2,1–14" }),
  sermon({ id: "d", title: "Håp i mørket", speaker: "", guestSpeakerName: "Gjest Ola Berg", date: "2026-01-04T11:00:00.000Z", bibleText: "Salme 130", series: "Advent" }),
];

const titlesOf = (list: CmsSermon[]) => list.map((s) => s.title);

describe("filterSermons", () => {
  test("søk finner treff i tittel, taler og bibeltekst", () => {
    expect(titlesOf(filterSermons(SERMONS, { query: "nær" }))).toEqual(["Guds rike er nær"]);
    expect(titlesOf(filterSermons(SERMONS, { query: "thomas" }))).toEqual(["Kalt til å følge"]);
    expect(titlesOf(filterSermons(SERMONS, { query: "lukas" }))).toEqual(["Nåde og tilgivelse"]);
  });

  test("søk ser ikke på store og små bokstaver eller aksenter", () => {
    expect(titlesOf(filterSermons(SERMONS, { query: "GUDS RIKE" }))).toEqual(["Guds rike er nær"]);
    expect(titlesOf(filterSermons(SERMONS, { query: "odegard" }))).toEqual(["Nåde og tilgivelse"]);
    expect(titlesOf(filterSermons(SERMONS, { query: "nåde" }))).toEqual(["Nåde og tilgivelse"]);
    expect(titlesOf(filterSermons(SERMONS, { query: "nade" }))).toEqual(["Nåde og tilgivelse"]);
  });

  test("tomt søk, eller bare mellomrom, gir alle talene", () => {
    expect(filterSermons(SERMONS, { query: "" })).toHaveLength(SERMONS.length);
    expect(filterSermons(SERMONS, { query: "   " })).toHaveLength(SERMONS.length);
    expect(filterSermons(SERMONS)).toHaveLength(SERMONS.length);
  });

  test("serie, taler og år filtrerer med eksakt treff, og tomt betyr alle", () => {
    expect(titlesOf(filterSermons(SERMONS, { series: "Advent" }))).toEqual(["Håp i mørket"]);
    expect(titlesOf(filterSermons(SERMONS, { speaker: "Gjest Ola Berg" }))).toEqual(["Håp i mørket"]);
    expect(filterSermons(SERMONS, { speaker: "Ola" })).toHaveLength(0);
    expect(titlesOf(filterSermons(SERMONS, { year: "2025" }))).toEqual(["Nåde og tilgivelse"]);
    expect(filterSermons(SERMONS, { series: "", speaker: "", year: "" })).toHaveLength(SERMONS.length);
  });

  test("kombinerte filtre må alle passe", () => {
    expect(titlesOf(filterSermons(SERMONS, { series: "Vandring gjennom Markus", year: "2026", query: "følge" }))).toEqual(["Kalt til å følge"]);
    expect(filterSermons(SERMONS, { series: "Vandring gjennom Markus", year: "2025" })).toHaveLength(0);
  });

  test("resultatet er sortert med nyeste først", () => {
    expect(titlesOf(filterSermons(SERMONS))).toEqual([
      "Guds rike er nær",
      "Kalt til å følge",
      "Håp i mørket",
      "Nåde og tilgivelse",
    ]);
  });

  test("filtrerer ikke originallisten", () => {
    const copy = [...SERMONS];
    filterSermons(SERMONS, { query: "nær" });
    expect(SERMONS).toEqual(copy);
  });
});

describe("sermonFilterOptions", () => {
  test("gir sorterte, unike serier og taler uten tomme verdier", () => {
    const options = sermonFilterOptions([
      ...SERMONS,
      sermon({ id: "e", title: "Ny", speaker: "Pastor Kari Nordmann", date: "2026-09-06T11:00:00.000Z", series: "  " }),
    ]);
    expect(options.series).toEqual(["Advent", "Vandring gjennom Markus"]);
    expect(options.speakers).toEqual(["Gjest Ola Berg", "Gjesteleder Thomas Vik", "Pastor Kari Nordmann", "Ødegård Ruth"]);
  });

  test("gir årene med det nyeste først, uten duplikater", () => {
    expect(sermonFilterOptions(SERMONS).years).toEqual(["2026", "2025"]);
  });

  test("sermonSpeakerOf bruker gjestetaleren når taleren mangler", () => {
    expect(sermonSpeakerOf(SERMONS[3])).toBe("Gjest Ola Berg");
    expect(sermonSpeakerOf(SERMONS[0])).toBe("Pastor Kari Nordmann");
  });
});

// The tab itself: search and filters narrow the table, and «Nullstill» clears them
const { cms } = vi.hoisted(() => ({
  cms: {
    sermons: [] as unknown[],
    saveSermon: vi.fn(),
    deleteSermon: vi.fn(),
  },
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => cms,
}));

import { SermonsTab } from "../src/pages/admin/tabs/SermonsTab";
import type { StudioData } from "../src/pages/admin/studio";

afterEach(() => {
  cleanup();
});

const renderTab = () => {
  cms.sermons = SERMONS;
  const studio = { currentUser: { name: "Test" } } as unknown as StudioData;
  return render(
    <MemoryRouter>
      <SermonsTab studio={studio} showFeedback={vi.fn()} />
    </MemoryRouter>,
  );
};

describe("SermonsTab søk og filtre", () => {
  test("å skrive i søket gjør tabellen smalere, og Nullstill viser alle igjen", () => {
    renderTab();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(SERMONS.length + 1);
    expect(screen.getByText("4 taler")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nullstill" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Søk i talene"), { target: { value: "markus" } });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("2 taler")).toBeTruthy();
    expect(screen.queryByText("Håp i mørket")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nullstill" }));
    expect((screen.getByLabelText("Søk i talene") as HTMLInputElement).value).toBe("");
    expect(within(table).getAllByRole("row")).toHaveLength(SERMONS.length + 1);
    expect(screen.queryByRole("button", { name: "Nullstill" })).toBeNull();
  });

  test("en tale i entall og en tom liste får riktig tekst", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Søk i talene"), { target: { value: "Ruth" } });
    expect(screen.getByText("1 tale")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Søk i talene"), { target: { value: "finnes ikke" } });
    expect(screen.getByText("Ingen taler passer til søket.")).toBeTruthy();
    expect(screen.getByText("0 taler")).toBeTruthy();
  });

  test("velger i Serie-listen filtrerer tabellen", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Serie"), { target: { value: "Advent" } });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Håp i mørket")).toBeTruthy();
  });
});
