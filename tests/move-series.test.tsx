// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MoveSeriesDialog } from "../src/pages/admin/MoveSeriesDialog";
import type { Gathering } from "../src/types";
import { combineDateAndTimeToIso, moveByDays, parseIsoToDateAndTime } from "../src/utils/dates";
import { daysBetween, movedRestOfSeries } from "../src/utils/series";

// The rest of a series moved to other days, when the rhythm turned out to be a week off.

const at = (day: string, time = "11:00") => combineDateAndTimeToIso(day, time);
const service = (id: string, day: string, more: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "kalender",
  title: "Gudstjeneste",
  startsAt: at(day),
  endsAt: at(day, "12:30"),
  seriesId: "serie-1",
  visibility: "offentlig",
  ...more,
});
// Every second Sunday, on the even weeks
const series = [service("des", "2026-12-20"), service("jan-3", "2027-01-03"), service("jan-17", "2027-01-17"), service("mar-28", "2027-03-28"), service("apr-11", "2027-04-11")];
const others = [service("annen-serie", "2027-01-17", { seriesId: "serie-2" }), service("enkelt", "2027-02-01", { seriesId: undefined })];
const dayAndTime = (moment: string) => `${parseIsoToDateAndTime(moment).date} ${parseIsoToDateAndTime(moment).time}`;

afterEach(cleanup);

describe("Dager mellom to datoer", () => {
  test("hele dager, fram og tilbake", () => {
    expect(daysBetween("2027-01-03", "2027-01-10")).toBe(7);
    expect(daysBetween("2027-01-10", "2027-01-03")).toBe(-7);
    expect(daysBetween("2027-01-03", "2027-01-03")).toBe(0);
    // Over the night the clock is moved to summer time
    expect(daysBetween("2027-03-21", "2027-03-28")).toBe(7);
  });

  test("det som ikke er en dato, gir ingenting", () => {
    expect(daysBetween("", "2027-01-10")).toBeNull();
    expect(daysBetween("2027-01-03", "10.01.2027")).toBeNull();
  });
});

describe("Et tidspunkt flyttet noen dager", () => {
  test("klokkeslettet er det samme, også over skiftet til sommertid", () => {
    expect(dayAndTime(moveByDays(at("2027-01-03"), 7))).toBe("2027-01-10 11:00");
    expect(dayAndTime(moveByDays(at("2027-03-21"), 7))).toBe("2027-03-28 11:00");
    expect(dayAndTime(moveByDays(at("2027-01-10"), -7))).toBe("2027-01-03 11:00");
  });

  test("en tekst som ikke er et tidspunkt, røres ikke", () => {
    expect(moveByDays("ikke et tidspunkt", 7)).toBe("ikke et tidspunkt");
  });
});

describe("Resten av en serie flyttet", () => {
  test("arrangementet og de etter det i samme serie flyttes like mange dager, med start og slutt", () => {
    const moved = movedRestOfSeries([...series, ...others], series[1], 7, moveByDays);
    expect(moved.map((event) => event.id)).toEqual(["jan-3", "jan-17", "mar-28", "apr-11"]);
    expect(moved.map((event) => dayAndTime(event.startsAt))).toEqual(["2027-01-10 11:00", "2027-01-24 11:00", "2027-04-04 11:00", "2027-04-18 11:00"]);
    expect(moved.map((event) => dayAndTime(event.endsAt!))).toEqual(["2027-01-10 12:30", "2027-01-24 12:30", "2027-04-04 12:30", "2027-04-18 12:30"]);
  });

  test("det som var før, andre serier og enkeltarrangementer røres ikke", () => {
    const moved = movedRestOfSeries([...series, ...others], series[1], 7, moveByDays);
    expect(moved.some((event) => ["des", "annen-serie", "enkelt"].includes(event.id))).toBe(false);
  });

  test("uten serie, eller uten dager å flytte, flyttes ingenting", () => {
    expect(movedRestOfSeries(series, others[1], 7, moveByDays)).toEqual([]);
    expect(movedRestOfSeries(series, series[1], 0, moveByDays)).toEqual([]);
  });

  test("et arrangement uten sluttid får ingen", () => {
    const open = service("uten-slutt", "2027-05-09", { endsAt: undefined });
    const [moved] = movedRestOfSeries([open], open, 7, moveByDays);
    expect("endsAt" in moved).toBe(false);
  });
});

describe("Skjemaet «Flytt resten av serien»", () => {
  const onMove = vi.fn();
  const open = (staffedCount = 0) =>
    render(<MoveSeriesDialog from={series[1]} gatherings={[...series, ...others]} staffedCount={staffedCount} onMove={onMove} onClose={() => {}} />);

  test("viser hvor arrangementene havner før noe flyttes", () => {
    onMove.mockClear();
    open();
    expect(screen.getByText(/og de 3 som kommer etter i serien/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Flytt/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/^Ny dato for/), { target: { value: "2027-01-10" } });
    expect(screen.getByText("4 arrangementer flyttes 7 dager fram")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Nye datoer" }).textContent).toMatch(/10\. jan.*24\. jan.*4\. apr.*18\. apr/);
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Flytt 4 arrangementer" }));
    expect(onMove).toHaveBeenCalledWith(7);
  });

  test("kan også flytte tilbake", () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Ny dato for/), { target: { value: "2026-12-27" } });
    expect(screen.getByText("4 arrangementer flyttes 7 dager tilbake")).toBeTruthy();
  });

  test("sier fra når noen står på oppgaver på arrangementene", () => {
    open(2);
    expect(screen.getByText(/2 av arrangementene har folk som er spurt eller står på en oppgave/)).toBeTruthy();
    cleanup();
    open(0);
    expect(screen.queryByText(/står på en oppgave/)).toBeNull();
  });
});
