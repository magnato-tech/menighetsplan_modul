// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CreateMeetingDialog } from "../src/components/husfellesskap/CreateMeetingDialog";
import type { HusfellesskapModel } from "../src/components/husfellesskap/husfellesskapModel";
import type { Group, Person } from "../src/types";

// Where a group leader plans the gatherings of the group. Today is Tuesday the 13th of October 2026.

const members: Person[] = [
  { id: "ellen", name: "Ellen Fossli", globalRole: "member" },
  { id: "lars", name: "Lars Fossli", globalRole: "member" },
  { id: "marit", name: "Marit Solberg", globalRole: "member" },
];
const houseGroup: Group = { id: "hus", name: "Husfellesskap Borkedalen", category: "husgruppe", memberIds: ["ellen", "lars", "marit"], leaderIds: ["ellen"] };
const everySecondThursday: Group = { ...houseGroup, meetingSchedule: { weekday: "Torsdag", time: "19:00", frequency: "annenhver uke" } };

type Occurrence = { startsAt: string; hostPersonId?: string; location?: string };
const createMeetings = vi.fn(async (_data: unknown, occurrences: Occurrence[]) => ({ success: true, created: occurrences.length }));
const showToast = vi.fn();
const onClose = vi.fn();

const open = (group: Group, held: { startsAt: string }[] = []) =>
  render(
    <CreateMeetingDialog
      model={{ group, members, createMeetings, allGroupMeetings: held } as unknown as HusfellesskapModel}
      showToast={showToast}
      onClose={onClose}
    />
  );
const occurrences = (): Occurrence[] => createMeetings.mock.calls[0][1];
const days = () => occurrences().map((occurrence) => occurrence.startsAt.slice(0, 10));
const create = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^Opprett/ }));
  await waitFor(() => expect(createMeetings).toHaveBeenCalledTimes(1));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T10:00:00.000Z"));
  createMeetings.mockClear();
  showToast.mockClear();
  onClose.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("En gruppe uten fast møtetid", () => {
  test("planlegger én samling om en uke, med første deltaker som vert, slik det var", async () => {
    open(houseGroup);
    expect((screen.getByLabelText(/Gjenta/) as HTMLSelectElement).value).toBe("once");
    expect((screen.getByLabelText("Dato *") as HTMLInputElement).value).toBe("2026-10-20");
    expect(screen.queryByRole("region", { name: "Dagene i planen" })).toBeNull();

    await create();
    expect(occurrences()).toHaveLength(1);
    expect(occurrences()[0]).toMatchObject({ hostPersonId: "ellen", location: "Hos Ellen Fossli" });
    expect(createMeetings.mock.calls[0][0]).toMatchObject({ title: "Husfellesskap", sendInvitationImmediately: true });
    expect(showToast).toHaveBeenCalledWith("Nytt møte opprettet og innkalling sendt!");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("En gruppe som møtes annenhver torsdag", () => {
  test("får hele semesteret foreslått: første torsdag, klokkeslettet til gruppen og til jul", () => {
    open(everySecondThursday);
    expect((screen.getByLabelText(/Gjenta/) as HTMLSelectElement).value).toBe("every2");
    expect((screen.getByLabelText("Første dato *") as HTMLInputElement).value).toBe("2026-10-15");
    expect((screen.getByLabelText("Klokkeslett *") as HTMLInputElement).value).toBe("19:00");
    expect((screen.getByLabelText("Til og med") as HTMLInputElement).value).toBe("2026-12-20");

    const plan = screen.getByRole("region", { name: "Dagene i planen" });
    expect(within(plan).getByText("Forslag: 5 samlinger")).toBeTruthy();
    expect(within(plan).getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Opprett 5 samlinger" })).toBeTruthy();
  });

  test("oppretter alle dagene med ett trykk, med verten åpen", async () => {
    open(everySecondThursday);
    await create();

    expect(days()).toEqual(["2026-10-15", "2026-10-29", "2026-11-12", "2026-11-26", "2026-12-10"]);
    // Who hosts is agreed from time to time: nothing is filled in on a guess
    expect(occurrences().every((occurrence) => occurrence.hostPersonId === undefined && occurrence.location === "")).toBe(true);
    expect(showToast).toHaveBeenCalledWith("5 samlinger er opprettet.");
  });

  test("en dag som ikke passer, tas ut med haken", async () => {
    open(everySecondThursday);
    fireEvent.click(screen.getByRole("checkbox", { name: /29\. okt/ }));
    expect(screen.getByText("Forslag: 4 samlinger")).toBeTruthy();

    await create();
    expect(days()).toEqual(["2026-10-15", "2026-11-12", "2026-11-26", "2026-12-10"]);
  });

  test("en dag gruppen alt har en samling på, opprettes ikke en gang til", async () => {
    // Thursday the 12th of November at 19:00 in Norway
    open(everySecondThursday, [{ startsAt: "2026-11-12T18:00:00.000Z" }]);
    expect(screen.getByText("Har alt en samling")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /12\. nov/ }) as HTMLInputElement).disabled).toBe(true);

    await create();
    expect(days()).toEqual(["2026-10-15", "2026-10-29", "2026-11-26", "2026-12-10"]);
  });

  test("«Bytt på» lar deltakerne ha hver sin gang, og «Samme vert» tar det tilbake", async () => {
    open(everySecondThursday);
    fireEvent.click(screen.getByRole("button", { name: "Bytt på" }));
    fireEvent.click(screen.getByRole("button", { name: "Samme vert" }));
    fireEvent.click(screen.getByRole("button", { name: "Bytt på" }));

    await create();
    expect(occurrences().map((occurrence) => occurrence.hostPersonId)).toEqual(["ellen", "lars", "marit", "ellen", "lars"]);
    expect(occurrences()[1].location).toBe("Hos Lars Fossli");
  });

  test("én vert for alle, og en annen vert én av gangene", async () => {
    open(everySecondThursday);
    fireEvent.change(screen.getByLabelText("Vert for alle"), { target: { value: "marit" } });
    fireEvent.change(screen.getByLabelText(/^Vert tor\. 29\. okt/), { target: { value: "lars" } });

    await create();
    expect(occurrences().map((occurrence) => occurrence.hostPersonId)).toEqual(["marit", "lars", "marit", "marit", "marit"]);
  });

  test("en adresse som er skrevet inn, gjelder alle samlingene", async () => {
    open(everySecondThursday);
    fireEvent.change(screen.getByLabelText("Sted / Adresse"), { target: { value: "Storgata 10" } });

    await create();
    expect(new Set(occurrences().map((occurrence) => occurrence.location))).toEqual(new Set(["Storgata 10"]));
  });

  test("siste dag kan flyttes, og uten noen dager kan ingenting opprettes", () => {
    open(everySecondThursday);
    fireEvent.change(screen.getByLabelText("Til og med"), { target: { value: "2026-11-01" } });
    expect(screen.getByText("Forslag: 2 samlinger")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /15\. okt/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /29\. okt/ }));
    expect((screen.getByRole("button", { name: "Opprett samling" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("deltakerne får vite at de bare spørres om den neste samlingen", () => {
    open(everySecondThursday);
    expect(screen.getByText(/spurt om de kommer til den neste samlingen/)).toBeTruthy();
  });
});

describe("Fra én samling til en plan", () => {
  test("verten blir åpen når samlingen settes til å gjentas", async () => {
    open(houseGroup);
    fireEvent.change(screen.getByLabelText(/Gjenta/), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText("Til og med"), { target: { value: "2026-11-03" } });

    await create();
    expect(days()).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
    expect(occurrences().every((occurrence) => occurrence.hostPersonId === undefined)).toBe(true);
  });
});
