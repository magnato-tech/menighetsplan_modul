// @vitest-environment jsdom
/**
 * «Bemanning» as the leader and the admin see it: one card per team, free slots filled from
 * «Fyll plassen», those who said no behind a small button, and the filter that shows what must be ordered.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Assignment, Group, Task } from "../src/types";
import type { GatheringDetail } from "../src/components/gathering/gatheringDetail";
import type { RunSheetTask } from "../src/utils/runSheet";
import { buildStaffingRoster, type RosterRow } from "../src/utils/staffingRoster";
import { RESPONSE_LABELS, calculateTaskStaffingStatus } from "../src/utils/staffing";
import { StaffingView } from "../src/components/gathering/StaffingView";

// The dialogs have their own tests; here they only show what they were asked for
vi.mock("../src/components/gathering/AssignPersonDialog", async () => {
  const { createElement } = await import("react");
  return {
    AssignPersonDialog: (props: { taskId: string; mode: string }) =>
      createElement("div", { "data-testid": "assign" }, `${props.taskId}:${props.mode}`),
  };
});
vi.mock("../src/components/gathering/InstructionDialog", () => ({ InstructionDialog: () => null }));
vi.mock("../src/components/gathering/EditTaskDialog", () => ({ EditTaskDialog: () => null }));

// The team's card in the popup: its tabs and name are real, what is inside the tabs is not needed here
vi.mock("../src/hooks/useAppHooks", () => ({
  useLeaderGroupDetail: (groupId: string) => ({
    hasAccess: true,
    hasLeaderAccess: true,
    isLeader: true,
    isDeputy: false,
    isAdmin: true,
    currentUser: { id: "kari", name: "Kari", globalRole: "admin" },
    group: {
      id: groupId,
      name: groupId === "lovsang" ? "Lovsang" : "Møtevert",
      category: "tjeneste",
      memberIds: [],
      leaderIds: [],
    },
    members: [],
    messages: [],
  }),
}));
vi.mock("../src/components/GroupChat", () => ({ GroupChat: () => null }));
vi.mock("../src/components/HusfellesskapView", () => ({ HusfellesskapView: () => null }));
vi.mock("../src/pages/leaderGroup/GroupScheduleCard", () => ({ GroupScheduleCard: () => null }));
vi.mock("../src/pages/leaderGroup/GroupActivities", () => ({ GroupActivities: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMembers", () => ({ GroupMembers: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMetaForm", () => ({ GroupMetaForm: () => null }));

const teams: Record<string, Group> = {
  lovsang: { id: "lovsang", name: "Lovsang", memberIds: [], leaderIds: [] },
  vert: { id: "vert", name: "Møtevert", memberIds: [], leaderIds: [] },
};

/** A role with its people, given as [name, response]. Same rules as the gathering view. */
function role(
  id: string,
  groupId: string | undefined,
  people: [string, Assignment["response"]][],
  extra: Partial<Task> = {}
): RunSheetTask {
  const task: Task = { id, gatheringId: "g", groupId, title: id, status: "open", neededCount: 1, ...extra };
  const assignments: Assignment[] = people.map(([name, response], i) => ({
    id: `${id}-${i}`,
    taskId: id,
    personId: `${id}-p${i}`,
    response,
    personName: name,
  }));
  const staffing = calculateTaskStaffingStatus(task, assignments);
  return {
    task,
    taskGroup: groupId ? teams[groupId] : undefined,
    isMyGroup: groupId === "lovsang",
    neededCount: staffing.neededCount,
    assignedPersons: assignments.map((assignment, i) => ({
      assignment,
      person: { id: assignment.personId, name: people[i][0], globalRole: "member" },
      statusLabel: RESPONSE_LABELS[assignment.response],
      response: assignment.response,
    })),
    confirmedPersonsCount: staffing.confirmedCount,
    isFullyCovered: staffing.isFullyCovered,
    hasWithdrawn: staffing.hasForfall,
  };
}

const details = [
  role("Lovsang", "lovsang", [["Lars Lyd", "confirmed"]]),
  role("Barnekirke", "lovsang", [["Berit Barn", "confirmed"], ["Frode Forfall", "withdrawn"]], { neededCount: 2 }),
  role("Kirkekaffe", "vert", [["Kari Kjøkken", "declined"]]),
  role("Møtevert", "vert", []),
  role("Taler", undefined, [["Tone Tale", "pending"]]),
];

function rowsOf(list: RunSheetTask[]): RosterRow[] {
  return buildStaffingRoster([], list);
}

const detail = {
  updateAssignmentStatus: vi.fn(() => ({ success: true })),
  removeAssignment: vi.fn(() => ({ success: true })),
} as unknown as GatheringDetail;

function renderView(rows: RosterRow[], canAdminister = true) {
  return render(
    <StaffingView detail={detail} rows={rows} canAdminister={canAdminister} showToast={() => undefined} />
  );
}

/** The card of one team, and the block of one role. */
const teamCard = (name: string) => screen.getByRole("region", { name });
const roleBlock = (id: string) => document.getElementById(`roster-${id}`)!;

afterEach(cleanup);

describe("Bemanning som team-kort", () => {
  test("hvert team har ett kort, og headeren teller bekreftet, venter og ledig, men viser ikke det som er null", () => {
    renderView(rowsOf(details));

    const lovsang = within(teamCard("Lovsang"));
    expect(lovsang.getByText("2 bekreftet")).toBeTruthy();
    expect(lovsang.getByText("1 ledig")).toBeTruthy();
    // Nothing waits, so neither the clock nor a 0 is shown
    expect(lovsang.queryByText(/venter/)).toBeNull();

    const vert = within(teamCard("Møtevert"));
    expect(vert.getByText("2 ledige")).toBeTruthy();
    expect(vert.queryByText(/bekreftet/)).toBeNull();
  });

  test("et team er foldet på mobil til headeren, og åpnes med et trykk", () => {
    renderView(rowsOf(details));

    const header = within(teamCard("Lovsang")).getByRole("button", { name: /^Lovsang/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });

  test("ingen rød «Må ordnes»-seksjon, bare teamene", () => {
    renderView(rowsOf(details));
    expect(screen.queryByText(/Må ordnes \(/)).toBeNull();
  });
});

describe("Ledig plass", () => {
  test("«Fyll plassen» åpner Tildel og Forespør, og Tildel kaller onAssign med bekreftet", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Kirkekaffe"));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    fireEvent.click(block.getByRole("button", { name: "Tildel" }));

    expect(screen.getByTestId("assign").textContent).toBe("Kirkekaffe:confirmed");
  });

  test("Forespør sender samme oppgave som forespurt", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Møtevert"));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    fireEvent.click(block.getByRole("button", { name: "Forespør" }));

    expect(screen.getByTestId("assign").textContent).toBe("Møtevert:pending");
  });

  test("Escape og et nytt trykk på «Fyll plassen» lukker valget", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Møtevert"));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    expect(block.queryByRole("button", { name: "Tildel" })).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(block.queryByRole("button", { name: "Tildel" })).toBeNull();

    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    expect(block.queryByRole("button", { name: "Tildel" })).toBeNull();
  });

  test("en leder ser ikke «Fyll plassen» i en annen gruppe", () => {
    renderView(rowsOf(details), false);

    expect(within(roleBlock("Barnekirke")).getByRole("button", { name: "Fyll plassen" })).toBeTruthy();
    expect(within(roleBlock("Møtevert")).queryByRole("button", { name: "Fyll plassen" })).toBeNull();
  });
});

describe("Sa nei", () => {
  test("de som sa nei er skjult bak «1 sa nei», og vises når den trykkes", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Kirkekaffe"));
    expect(screen.queryByText("Kari Kjøkken")).toBeNull();
    fireEvent.click(block.getByRole("button", { name: "1 sa nei" }));
    expect(block.getByText("Kari Kjøkken")).toBeTruthy();
  });
});

describe("Filteret «Vis bare det som må ordnes»", () => {
  test("viser bare forfall og ubesatt, og skjuler team uten dem", () => {
    renderView(rowsOf(details));

    const filter = screen.getByRole("button", { name: "Vis bare det som må ordnes" });
    expect(filter.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(filter);
    expect(filter.getAttribute("aria-pressed")).toBe("true");

    expect(roleBlock("Barnekirke")).toBeTruthy();
    expect(roleBlock("Møtevert")).toBeTruthy();
    expect(document.getElementById("roster-Lovsang")).toBeNull();
    expect(document.getElementById("roster-Taler")).toBeNull();
    expect(screen.queryByRole("region", { name: "Uten team" })).toBeNull();
  });

  test("når ingenting må ordnes, står knappen som «Alt er dekket» og er avslått", () => {
    renderView(rowsOf([role("Lovsang", "lovsang", [["Lars Lyd", "confirmed"]])]));

    const filter = screen.getByRole("button", { name: "Alt er dekket" }) as HTMLButtonElement;
    expect(filter.disabled).toBe(true);
  });
});

/** The header button of a team, which says whether it is open. */
const teamHeader = (name: string) => within(teamCard(name)).getByRole("button", { name: new RegExp(`^${name}`) });

describe("Foldes per team", () => {
  test("«Fold sammen alle» folder alle team, og «Fold ut alle» åpner dem", () => {
    renderView(rowsOf(details));
    const names = ["Lovsang", "Møtevert", "Uten team"];
    for (const name of names) expect(teamHeader(name).getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Fold ut alle" }));
    for (const name of names) expect(teamHeader(name).getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Fold sammen alle" }));
    for (const name of names) expect(teamHeader(name).getAttribute("aria-expanded")).toBe("false");
  });

  test("fra md starter alle team åpne, og et trykk på headeren folder det", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    try {
      renderView(rowsOf(details));
      expect(teamHeader("Lovsang").getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(teamHeader("Lovsang"));
      expect(teamHeader("Lovsang").getAttribute("aria-expanded")).toBe("false");
    } finally {
      window.matchMedia = original;
    }
  });

  test("et team med valgt rolle åpnes, og rollen er merket og rullet til", () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: scroll, configurable: true, writable: true });

    render(
      <StaffingView
        detail={detail}
        rows={rowsOf(details)}
        canAdminister
        highlightTaskId="Barnekirke"
        focusTaskId="Barnekirke"
        focusNonce={1}
        showToast={() => undefined}
      />
    );
    expect(teamHeader("Lovsang").getAttribute("aria-expanded")).toBe("true");
    expect(roleBlock("Barnekirke").getAttribute("aria-current")).toBe("true");
    expect(roleBlock("Lovsang").getAttribute("aria-current")).toBeNull();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  test("valg av samme rolle to ganger ruller til den igjen", () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: scroll, configurable: true, writable: true });

    const props = { detail, canAdminister: true, highlightTaskId: "Barnekirke", focusTaskId: "Barnekirke", showToast: () => undefined };
    const view = render(<StaffingView {...props} rows={rowsOf(details)} focusNonce={1} />);
    view.rerender(<StaffingView {...props} rows={rowsOf(details)} focusNonce={2} />);
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  test("en rolle uten programtid står med «Utenfor programmet»", () => {
    const schedule = [{ time: "10:00", title: "Preken", taskId: "Taler" }];
    renderView(buildStaffingRoster(schedule, details));

    expect(within(roleBlock("Lovsang")).getByText("Utenfor programmet")).toBeTruthy();
    expect(within(roleBlock("Taler")).queryByText("Utenfor programmet")).toBeNull();
  });

  test("et valgt fra programmet vises selv om «må ordnes»-filteret skjuler den, og filteret slås av", () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: scroll, configurable: true, writable: true });

    const props = { detail, canAdminister: true, showToast: () => undefined };
    const view = render(<StaffingView {...props} rows={rowsOf(details)} />);
    fireEvent.click(screen.getByRole("button", { name: "Vis bare det som må ordnes" }));
    expect(document.getElementById("roster-Lovsang")).toBeNull();

    view.rerender(<StaffingView {...props} rows={rowsOf(details)} highlightTaskId="Lovsang" focusTaskId="Lovsang" focusNonce={1} />);
    expect(screen.getByRole("button", { name: "Vis bare det som må ordnes" }).getAttribute("aria-pressed")).toBe("false");
    expect(roleBlock("Lovsang").getAttribute("aria-current")).toBe("true");
    expect(teamHeader("Lovsang").getAttribute("aria-expanded")).toBe("true");
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});

/** The icon that opens a team's card, and the popup it opens. */
const openIcon = (name: string) => screen.getByRole("button", { name: `Åpne teamet ${name}` });
const popup = () => screen.getByRole("dialog");

describe("Teamkortet i en popup", () => {
  test("et team med gruppe har ikon med navn, «Uten team» har ingen", () => {
    renderView(rowsOf(details));

    expect(openIcon("Lovsang").getAttribute("title")).toBe("Åpne teamet Lovsang");
    expect(openIcon("Møtevert")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Uten team" })).queryByRole("button", { name: /Åpne teamet/ })).toBeNull();
  });

  test("ikonet ligger utenfor foldeknappen, så det ikke blir en knapp i en knapp", () => {
    renderView(rowsOf(details));

    expect(teamCard("Lovsang").contains(openIcon("Lovsang"))).toBe(true);
    expect(teamHeader("Lovsang").contains(openIcon("Lovsang"))).toBe(false);
  });

  test("et trykk på ikonet åpner kortet med gruppens navn og de tre fanene", () => {
    renderView(rowsOf(details));

    fireEvent.click(openIcon("Lovsang"));

    const dialog = popup();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toBe("Lovsang");
    expect(within(dialog).getByRole("heading", { name: "Lovsang" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Aktiviteter/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Gruppechat/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Deltakere/ })).toBeTruthy();
  });

  test("Escape lukker kortet, og Bemanning står som før med samme foldete team", () => {
    renderView(rowsOf(details));
    fireEvent.click(teamHeader("Møtevert"));
    expect(teamHeader("Møtevert").getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(openIcon("Lovsang"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(teamCard("Lovsang")).toBeTruthy();
    expect(teamCard("Møtevert")).toBeTruthy();
    expect(teamHeader("Lovsang").getAttribute("aria-expanded")).toBe("false");
    expect(teamHeader("Møtevert").getAttribute("aria-expanded")).toBe("true");
  });

  test("«Lukk» og et trykk utenfor kortet lukker det", () => {
    renderView(rowsOf(details));

    fireEvent.click(openIcon("Lovsang"));
    fireEvent.click(screen.getByRole("button", { name: "Lukk" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(openIcon("Møtevert"));
    fireEvent.click(popup().parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("fokus går inn i kortet og tilbake til ikonet når det lukkes, og siden får rulle igjen", () => {
    renderView(rowsOf(details));

    fireEvent.click(openIcon("Lovsang"));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lukk" }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Lukk" }));
    expect(document.activeElement).toBe(openIcon("Lovsang"));
    expect(document.body.style.overflow).toBe("");
  });

  test("en leder ser ikonet bare på egne team", () => {
    renderView(rowsOf(details), false);

    expect(openIcon("Lovsang")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Åpne teamet Møtevert" })).toBeNull();
  });
});
