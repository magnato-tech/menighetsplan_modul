// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PeopleEngagementSection } from "../src/pages/admin/tabs/analytics/PeopleEngagementSection";
import { StaffingPerGatheringSection } from "../src/pages/admin/tabs/analytics/StaffingPerGatheringSection";
import type { Assignment, Gathering, Group, Person, Task } from "../src/types";
import { ANALYTICS_PERIODS, analyticsPeriod, highLoadThreshold, summarizeEngagement, summarizeFullStaffing, summarizeGroups, summarizeVolunteers } from "../src/utils/churchAnalytics";

// The analysis board looking ahead: what is planned from now on, counted from the tasks people
// have said yes to. Everyone here is made up.

const now = new Date("2026-10-13T12:00:00.000Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(now + days * DAY).toISOString();

const persons: Person[] = ["Anne", "Bjørn", "Cecilie", "David"].map((name, at) => ({ id: `p${at + 1}`, name, globalRole: "member" }));
const groups: Group[] = [{ id: "lyd", name: "Lyd", category: "tjenestegruppe", memberIds: ["p1", "p2"], leaderIds: [] }];
const service = (id: string, days: number, more: Partial<Gathering> = {}): Gathering => ({ id, groupId: "kalender", title: "Gudstjeneste", startsAt: inDays(days), type: "arrangement", visibility: "offentlig", isGudstjeneste: true, ...more });
const gatherings = [service("forrige", -7), service("g1", 5), service("g2", 12), service("g3", 19), service("g4", 26), service("senere", 60), service("avlyst", 8, { cancelled: true })];
const task = (id: string, gatheringId: string, title: string, neededCount = 1): Task => ({ id, gatheringId, groupId: "lyd", title, status: "open", neededCount });
const tasks = [
  task("t-forrige", "forrige", "Lyd"),
  task("t1-lyd", "g1", "Lyd"),
  task("t1-bilde", "g1", "Bilde"),
  task("t2-lyd", "g2", "Lyd"),
  task("t3-lyd", "g3", "Lyd"),
  task("t4-lyd", "g4", "Lyd", 2),
  task("t-senere", "senere", "Lyd"),
  task("t-avlyst", "avlyst", "Lyd"),
];
const on = (taskId: string, personId: string, response: Assignment["response"] = "confirmed"): Assignment => ({ id: `${taskId}-${personId}`, taskId, personId, response });
const assignments = [
  on("t-forrige", "p2"),
  on("t1-lyd", "p1"),
  on("t1-bilde", "p1"),
  on("t2-lyd", "p1"),
  on("t3-lyd", "p1"),
  on("t4-lyd", "p2"),
  on("t4-lyd", "p3", "pending"),
  on("t-senere", "p4"),
  on("t-avlyst", "p4"),
];
const data = { persons, groups, gatherings, tasks, assignments, attendances: [] };

afterEach(cleanup);

describe("Perioden framover", () => {
  test("går fra nå og framover, og har ingen periode før å sammenligne med", () => {
    const period = analyticsPeriod("next4w", now);
    expect(period).toMatchObject({ direction: "ahead", from: now, to: now + 28 * DAY, previousFrom: now, weeks: 4 });
    expect(analyticsPeriod("4w", now)).toMatchObject({ direction: "back", from: now - 28 * DAY, to: now });
    expect(ANALYTICS_PERIODS.filter((p) => p.direction === "ahead").map((p) => p.label)).toEqual(["Neste 4 uker", "Neste 3 måneder", "Neste halvår"]);
    expect(ANALYTICS_PERIODS.filter((p) => p.direction === "back").map((p) => p.label)).toEqual(["Siste 4 uker", "Siste 3 måneder", "Siste 12 måneder"]);
  });

  test("hver enkelt telles med oppgavene de har sagt ja til på arrangementene som kommer", () => {
    const engagement = summarizeEngagement(data, analyticsPeriod("next4w", now));
    expect(engagement.worshipHeld).toBe(4);
    const of = (id: string) => engagement.people.find((row) => row.person.id === id)!;
    // Anne: four tasks on three services, two of them on the same one
    expect(of("p1")).toMatchObject({ tasks: 4, gatheringsServed: 3, worshipServed: 3, multiTaskTimes: 1 });
    // Bjørn: the one that comes. The one that is held, is not counted ahead
    expect(of("p2")).toMatchObject({ tasks: 1, gatheringsServed: 1 });
    // Cecilie is asked and has not answered: that is not a task she has
    expect(of("p3")).toMatchObject({ tasks: 0, gatheringsServed: 0 });
    // David: only after the period, and on a cancelled service
    expect(of("p4").tasks).toBe(0);
    expect(summarizeEngagement(data, analyticsPeriod("next3m", now)).people.find((row) => row.person.id === "p4")!.tasks).toBe(1);
  });

  test("bemanningen telles for arrangementene som kommer, uten den som bare er spurt", () => {
    const staffing = summarizeFullStaffing(data, analyticsPeriod("next4w", now));
    expect(staffing.gatherings.map((row) => row.gathering.id)).toEqual(["g1", "g2", "g3", "g4"]);
    expect(staffing.full).toBe(3);
    expect(staffing.previousRate).toBeNull();
    expect(staffing.notFull.map((row) => [row.gathering.id, row.missing, row.needed])).toEqual([["g4", 1, 2]]);
  });
});

describe("«Nå» er nå, også når perioden går framover", () => {
  test("de neste fire ukene telles fra i dag, ikke fra slutten av perioden", () => {
    expect(analyticsPeriod("next6m", now).now).toBe(now);
    expect(analyticsPeriod("12m", now).now).toBe(now);
    const volunteers = summarizeVolunteers({ ...data, volunteerRoles: [] }, analyticsPeriod("next6m", now));
    // g1–g4 come the next four weeks: six places, five of them said yes to
    expect(volunteers.upcoming).toMatchObject({ slotsNeeded: 6, slotsFilled: 5, openSlots: 1 });
    // The same number looking back: it is what comes from today in both
    expect(summarizeVolunteers({ ...data, volunteerRoles: [] }, analyticsPeriod("4w", now)).upcoming).toEqual(volunteers.upcoming);
  });

  test("en gruppe var sist aktiv da den sist hadde noe, ikke på en samling som kommer", () => {
    const meeting = (id: string, days: number): Gathering => ({ id, groupId: "lyd", title: "Teamkveld", startsAt: inDays(days), type: "gruppesamling", visibility: "intern" });
    const withMeetings = { ...data, gatherings: [...gatherings, meeting("m-før", -3), meeting("m-etter", 20)], messages: [] };
    const group = summarizeGroups(withMeetings, analyticsPeriod("next3m", now)).groups.find((row) => row.group.id === "lyd")!;
    expect(group.lastActivityAt).toBe(inDays(-3));
    expect(group.quiet).toBe(false);
    // The meeting that comes, is counted as planned in the period
    expect(group.meetings).toBe(1);
  });
});

describe("Tabellene når bordet ser framover", () => {
  const period = analyticsPeriod("next4w", now);
  const inRouter = (element: React.ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

  test("«Hver enkelt» sier at det er oppgaver de har sagt ja til, og merker den som har mye", () => {
    inRouter(<PeopleEngagementSection engagement={summarizeEngagement(data, period)} ahead highLoadFrom={highLoadThreshold(period)} />);
    expect(screen.getByText(/oppgaver de har sagt ja til i perioden som kommer.*de 4 gudstjenestene.*spurt og ikke har svart, teller ikke.*«Mye» står på den som har oppgaver på 3 arrangementer eller flere/)).toBeTruthy();
    const line = (name: string) => screen.getByRole("link", { name }).closest("tr")!;
    expect(within(line("Anne")).getByText("Mye")).toBeTruthy();
    expect(line("Anne").textContent).toContain("3 av 4");
    for (const name of ["Bjørn", "Cecilie", "David"]) expect(within(line(name)).queryByText("Mye")).toBeNull();
    expect(screen.getByLabelText("Bare de som har oppgaver")).toBeTruthy();
  });

  test("bakover er «Hver enkelt» som før, uten merke", () => {
    inRouter(<PeopleEngagementSection engagement={summarizeEngagement(data, analyticsPeriod("4w", now))} />);
    expect(screen.getByText(/oppgaver i perioden, på hvor mange av de 1 gudstjenestene de hadde en oppgave/)).toBeTruthy();
    expect(screen.queryByText("Mye")).toBeNull();
    expect(screen.getByLabelText("Bare de som har vært med")).toBeTruthy();
  });

  test("«Bemanning per arrangement» sier hva som mangler, det nærmeste først, uten sammenligning med før", () => {
    const more = { ...data, assignments: assignments.filter((a) => a.taskId !== "t2-lyd") };
    inRouter(<StaffingPerGatheringSection period={period} staffing={summarizeFullStaffing(more, period)} />);
    expect(screen.getByText(/Arrangementer som kommer i perioden og har oppgaver/)).toBeTruthy();
    expect(screen.getByText("2 plasser mangler til sammen")).toBeTruthy();
    const lacking = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(lacking).toHaveLength(2);
    expect(lacking[0]).toMatch(/mangler 1 av 1/);
    expect(lacking[1]).toMatch(/mangler 1 av 2/);
    expect(screen.queryByText(/fra forrige/)).toBeNull();
  });
});
