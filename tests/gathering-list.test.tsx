// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AdminGatheringItem } from "../src/hooks/adminHooks";
import { GatheringsTable } from "../src/pages/admin/tabs/gatherings/GatheringsTable";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { gatheringsInPeriod, nextGatheringSort, sortGatherings } from "../src/utils/gatheringList";

// The admin's list of events: by date until another column is pressed, and as a table.

const row = (id: string, day: string, title: string, location: string, missing: number, more: Record<string, unknown> = {}): AdminGatheringItem =>
  ({
    gathering: { id, groupId: "kalender", title, startsAt: combineDateAndTimeToIso(day, "11:00"), location, visibility: "offentlig", ...more },
    tasks: [],
    staffing: { color: missing > 0 ? "red" : "green" },
    totalTasks: 12,
    coveredTasksCount: 12 - missing,
    missingStaffingCount: missing,
  }) as unknown as AdminGatheringItem;

// In the order the database gives them: not by date
const rows = [
  row("bonn", "2027-01-11", "Bønn for Lillesand", "Filadelfia", 0),
  row("nov-22", "2026-11-22", "Gudstjeneste", "Bedehuset", 2, { seriesId: "serie", theme: "Søndag for de forfulgte", isGudstjeneste: true }),
  row("des-20", "2026-12-20", "Gudstjeneste", "Bedehuset", 14, { seriesId: "serie", isGudstjeneste: true }),
  row("okt-25", "2026-10-25", "Gudstjeneste", "Bedehuset", 1, { seriesId: "serie", isGudstjeneste: true }),
  row("mote", "2026-10-26", "Menighetsmøte", "Bjørkeveien 11B", 0),
];
const ids = (list: AdminGatheringItem[]) => list.map((item) => item.gathering.id);

afterEach(cleanup);

describe("Rekkefølgen på arrangementene", () => {
  test("uten noe valgt står de etter dato, det første først", () => {
    expect(ids(sortGatherings(rows))).toEqual(["okt-25", "mote", "nov-22", "des-20", "bonn"]);
  });

  test("dato kan snus", () => {
    expect(ids(sortGatherings(rows, "date", "desc"))).toEqual(["bonn", "des-20", "nov-22", "mote", "okt-25"]);
  });

  test("etter tittel og sted står like arrangementer fortsatt etter dato", () => {
    expect(ids(sortGatherings(rows, "title", "asc"))).toEqual(["bonn", "okt-25", "nov-22", "des-20", "mote"]);
    expect(ids(sortGatherings(rows, "location", "asc"))).toEqual(["okt-25", "nov-22", "des-20", "mote", "bonn"]);
  });

  test("etter bemanning kommer de som mangler flest, først når kolonnen snus", () => {
    expect(ids(sortGatherings(rows, "staffing", "desc"))).toEqual(["des-20", "nov-22", "okt-25", "mote", "bonn"]);
    expect(ids(sortGatherings(rows, "staffing", "asc")).slice(0, 2)).toEqual(["mote", "bonn"]);
  });

  test("listen som kom inn, røres ikke", () => {
    sortGatherings(rows, "date", "desc");
    expect(ids(rows)[0]).toBe("bonn");
  });

  test("samme kolonne en gang til snur, en ny kolonne begynner med det laveste", () => {
    expect(nextGatheringSort("date", "asc", "date")).toEqual({ key: "date", direction: "desc" });
    expect(nextGatheringSort("date", "desc", "date")).toEqual({ key: "date", direction: "asc" });
    expect(nextGatheringSort("date", "desc", "staffing")).toEqual({ key: "staffing", direction: "asc" });
  });
});

describe("Arrangementene som tabell", () => {
  const handlers = { onSort: vi.fn(), onMoveRest: vi.fn(), onNext: vi.fn(), onDelete: vi.fn() };
  const show = () =>
    render(
      <MemoryRouter>
        <GatheringsTable rows={sortGatherings(rows)} sortKey="date" sortDirection="asc" {...handlers} />
      </MemoryRouter>
    );
  const lines = () => screen.getAllByRole("row").slice(1);

  test("én linje per arrangement, i rekkefølgen den får", () => {
    show();
    expect(lines()).toHaveLength(5);
    expect(lines()[0].textContent).toMatch(/25\. okt.*Gudstjeneste.*Bedehuset.*Mangler 1/);
    expect(lines()[4].textContent).toMatch(/11\. jan.*Bønn for Lillesand.*Filadelfia.*Dekket \(12\/12\)/);
    expect(within(lines()[2]).getByText("Tema: Søndag for de forfulgte")).toBeTruthy();
  });

  test("et arrangement uten oppgaver står med «Ingen oppgaver», ikke som dekket eller som noe som mangler", () => {
    render(
      <MemoryRouter>
        <GatheringsTable
          rows={[{ ...row("uten", "2026-11-11", "Menighetsmøte", "Bjørkeveien 11B", 0), totalTasks: 0, coveredTasksCount: 0 } as AdminGatheringItem, rows[1]]}
          sortKey="date"
          sortDirection="asc"
          {...handlers}
        />
      </MemoryRouter>
    );
    expect(lines()[0].textContent).toMatch(/Menighetsmøte.*Ingen oppgaver/);
    expect(lines()[0].textContent).not.toMatch(/Dekket|Mangler|Venter/);
    expect(lines()[1].textContent).toMatch(/Mangler 2/);
  });

  test("kolonnen som er valgt, er merket, og et trykk på en overskrift ber om sortering", () => {
    handlers.onSort.mockClear();
    show();
    expect(screen.getByRole("columnheader", { name: "Dato" }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("columnheader", { name: "Sted" }).getAttribute("aria-sort")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Bemanning" }));
    expect(handlers.onSort).toHaveBeenCalledWith("staffing");
  });

  test("et arrangement i en serie kan flyttes med resten, et enkeltarrangement har ikke det valget", () => {
    handlers.onMoveRest.mockClear();
    show();
    const service = lines()[0];
    fireEvent.click(within(service).getByRole("button", { name: /^Flytt resten av serien/ }));
    expect(handlers.onMoveRest.mock.calls[0][0].gathering.id).toBe("okt-25");

    const meeting = lines()[1];
    expect(within(meeting).queryByRole("button", { name: /resten av serien/ })).toBeNull();
  });

  test("tabellen har ingen knapp som sletter mange arrangementer på en gang", () => {
    show();
    expect(screen.queryByRole("button", { name: /Slett resten/ })).toBeNull();
  });

  test("hver linje fører til kjøreplanen, og kan slettes eller følges av et nytt arrangement", () => {
    handlers.onNext.mockClear();
    handlers.onDelete.mockClear();
    show();
    const meeting = lines()[1];
    expect(within(meeting).getByRole("link", { name: "Kjøreplan" }).getAttribute("href")).toBe("/admin/samling/mote?vis=program");
    expect(within(meeting).getByRole("link", { name: "Menighetsmøte" }).getAttribute("href")).toBe("/admin/samling/mote?vis=bemanning");
    fireEvent.click(within(meeting).getByRole("button", { name: /^Lag neste arrangement/ }));
    fireEvent.click(within(meeting).getByRole("button", { name: /^Slett Menighetsmøte/ }));
    expect(handlers.onNext.mock.calls[0][0].gathering.id).toBe("mote");
    expect(handlers.onDelete.mock.calls[0][0].gathering.id).toBe("mote");
  });
});

describe("Kommende og tidligere arrangementer", () => {
  // Between the service on 25 October and the meeting the day after
  const now = new Date(combineDateAndTimeToIso("2026-10-25", "18:00")).getTime();

  test("kommende står fra det nærmeste", () => {
    expect(ids(gatheringsInPeriod(rows, "kommende", now))).toEqual(["mote", "nov-22", "des-20", "bonn"]);
  });

  test("tidligere står fra det siste som ble holdt", () => {
    const earlier = [...rows, row("okt-18", "2026-10-18", "Gudstjeneste", "Bedehuset", 0)];
    expect(ids(gatheringsInPeriod(earlier, "tidligere", now))).toEqual(["okt-25", "okt-18"]);
  });

  test("et arrangement som pågår, er kommende", () => {
    const during = new Date(combineDateAndTimeToIso("2026-10-25", "12:00")).getTime();
    expect(ids(gatheringsInPeriod(rows, "kommende", during))[0]).toBe("okt-25");
  });

  test("en annen kolonne sorterer innenfor perioden", () => {
    expect(ids(gatheringsInPeriod(rows, "kommende", now, "staffing", "desc"))).toEqual(["des-20", "nov-22", "mote", "bonn"]);
  });
});
