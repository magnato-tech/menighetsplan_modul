// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Gathering } from "../src/types";
import { siteCheck } from "../src/utils/siteCheck";
import { SiteCheckCard } from "../src/components/admin/SiteCheckCard";

// The website check groups the upcoming events of one series, and the card lets a line be put aside («Ikke nå»).

vi.mock("../src/components/gathering/GatheringWebsiteFields", () => ({ default: () => null }));

const PUT_ASIDE_KEY = "menighetsplan:sjekk-ikke-naa";
const now = Date.UTC(2026, 10, 23, 9);

const event = (id: string, title: string, startsAt: string, seriesId?: string): Gathering =>
  ({
    id,
    groupId: "g",
    title,
    startsAt,
    visibility: "offentlig",
    isPublic: true,
    type: "gudstjeneste",
    ...(seriesId ? { seriesId } : {}),
  }) as unknown as Gathering;

const series = [
  event("a", "Gudstjeneste", "2026-12-06T10:00:00Z", "s1"),
  event("b", "Gudstjeneste", "2026-12-20T10:00:00Z", "s1"),
  event("c", "Gudstjeneste", "2027-01-03T10:00:00Z", "s1"),
];
const single = event("x", "Kirkekaffe", "2026-12-13T10:00:00Z");

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Sjekk nettsiden: grupper i en serie", () => {
  test("tre kommende i samme serie blir én linje med antall, datoer og alle id-ene i dato-rekkefølge", () => {
    const findings = siteCheck({ pages: [], news: [], gatherings: [series[2], series[0], series[1]], media: [], now });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: "eventMissing",
      where: "Gudstjeneste",
      what: "3 kommende mangler bilde og tekst: 6. des., 20. des., 3. jan.",
      key: "eventMissing:series:s1",
      seriesId: "s1",
      gatheringIds: ["a", "b", "c"],
    });
  });

  test("fem i serien skriver fire datoer og så «…»", () => {
    const five = [0, 1, 2, 3, 4].map((week) => event(`w${week}`, "Bønnemøte", new Date(now + (week + 1) * 7 * 86_400_000).toISOString(), "s2"));
    const [finding] = siteCheck({ pages: [], news: [], gatherings: five, media: [], now });
    expect(finding.what).toMatch(/^5 kommende mangler bilde og tekst: .+, .+, .+, .+, …$/);
    expect(finding.gatheringIds).toHaveLength(5);
  });

  test("en enkelt hendelse blir stående alene, med sin egen nøkkel og id", () => {
    const findings = siteCheck({ pages: [], news: [], gatherings: [series[0], single], media: [], now });
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({ kind: "eventMissing", key: "eventMissing:a", gatheringIds: ["a"] });
    expect(findings[0].seriesId).toBeUndefined();
    expect(findings[0].where).toMatch(/^Gudstjeneste · /);
    expect(findings[0].what).toBe("Mangler bilde og tekst på nettsiden");
    expect(findings[1]).toMatchObject({ key: "eventMissing:x", gatheringIds: ["x"], where: expect.stringMatching(/^Kirkekaffe · / ) });
  });

  test("en serie med bare én kommende hendelse som mangler noe blir ikke gruppert", () => {
    const findings = siteCheck({ pages: [], news: [], gatherings: [series[0], event("z", "Gudstjeneste", "2026-12-06T10:00:00Z", "s9")], media: [], now });
    expect(findings.map((finding) => finding.key)).toEqual(["eventMissing:a", "eventMissing:z"]);
  });
});

function renderCard(
  gatherings: Gathering[],
  onSaveGathering = vi.fn<(id: string, updates: Partial<Gathering>) => { success: boolean; error?: string }>(() => ({ success: true }))
) {
  const onTabChange = vi.fn();
  const utils = render(
    <SiteCheckCard pages={[]} news={[]} gatherings={gatherings} media={[]} now={now} onTabChange={onTabChange} onSaveGathering={onSaveGathering} />
  );
  return { ...utils, onTabChange, onSaveGathering };
}

describe("Sjekk nettsiden: Ikke nå", () => {
  test("«Ikke nå» skjuler linjen, teller ned, huskes etter ny visning, og «Vis» / «Ta tilbake» henter den", () => {
    const { unmount } = renderCard([...series, single]);
    expect(screen.getByText("2 ting å se på")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Ikke nå" })[0]);
    expect(screen.getByText("1 ting å se på")).toBeTruthy();
    expect(screen.queryByText("3 kommende mangler bilde og tekst: 6. des., 20. des., 3. jan.")).toBeNull();
    expect(screen.getByText(/1 ting er satt til «Ikke nå»/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(PUT_ASIDE_KEY) || "[]")).toEqual(["eventMissing:series:s1"]);

    unmount();
    renderCard([...series, single]);
    expect(screen.getByText("1 ting å se på")).toBeTruthy();
    expect(screen.queryByText(/^Kirkekaffe · /)).not.toBeNull();
    expect(screen.queryByText(/3 kommende mangler/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vis" }));
    expect(screen.getByRole("button", { name: "Skjul" })).toBeTruthy();
    const hiddenLine = screen.getByText(/3 kommende mangler/).closest("li") as HTMLElement;
    fireEvent.click(within(hiddenLine).getByRole("button", { name: "Ta tilbake" }));
    expect(screen.getByText("2 ting å se på")).toBeTruthy();
    expect(screen.queryByText(/satt til «Ikke nå»/)).toBeNull();
    expect(within(hiddenLine).getByRole("button", { name: "Ikke nå" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(PUT_ASIDE_KEY) || "[]")).toEqual([]);
  });

  test("ødelagt lagring gir vanlig visning, ikke en feil", () => {
    window.localStorage.setItem(PUT_ASIDE_KEY, "{ikke json");
    renderCard(series);
    expect(screen.getByText("1 ting å se på")).toBeTruthy();
  });
});

describe("Sjekk nettsiden: Bilde og tekst", () => {
  test("på alle åpner dialogen for den første, og lagrer for alle når boksen er huket av", () => {
    const { onSaveGathering } = renderCard(series);
    fireEvent.click(screen.getByRole("button", { name: "Bilde og tekst på alle" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText("Bruk samme bilde og tekst på de andre kommende i serien (2)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));
    expect(onSaveGathering.mock.calls.map((call) => call[0])).toEqual(["a", "b", "c"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("uten avkrysning lagres bare den ene hendelsen", () => {
    const { onSaveGathering } = renderCard(series);
    fireEvent.click(screen.getByRole("button", { name: "Bilde og tekst på alle" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));
    expect(onSaveGathering.mock.calls.map((call) => call[0])).toEqual(["a"]);
  });

  test("for en enkelt hendelse finnes ingen avkrysning", () => {
    const { onSaveGathering } = renderCard([single]);
    fireEvent.click(screen.getByRole("button", { name: "Bilde og tekst" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));
    expect(onSaveGathering.mock.calls.map((call) => call[0])).toEqual(["x"]);
  });
});
