// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GroupActivities } from "../src/pages/leaderGroup/GroupActivities";
import type { LeaderGroupDetail } from "../src/pages/leaderGroup/leaderGroupDetail";

// The line over a group leader's activities: it says that all is covered only when it is.

const activity = (id: string, color: "red" | "yellow" | "green", tasks: { status: string }[] = []) => ({
  gathering: { id, groupId: "g", title: `Gudstjeneste ${id}`, startsAt: "2026-11-08T10:00:00.000Z", type: "arrangement", visibility: "offentlig" },
  tasks,
  taskItems: [],
  staffing: { color, badgeText: color === "red" ? "Mangler 1" : color === "yellow" ? "Venter på svar" : "Dekket" },
});
const show = (activities: ReturnType<typeof activity>[]) =>
  render(
    <MemoryRouter>
      <GroupActivities detail={{ hasLeaderAccess: true, members: [], groupGatherings: activities, assignTaskToPerson: () => ({ success: true }) } as unknown as LeaderGroupDetail} showToast={() => {}} />
    </MemoryRouter>
  );
const filter = () => (document.getElementById("select-group-filter-status") as HTMLSelectElement).value;

afterEach(cleanup);

describe("Statuslinjen hos gruppelederen", () => {
  test("mangler aktiviteter folk, sier den det, og ikke at alt er dekket", () => {
    show([activity("a", "red"), activity("b", "red"), activity("c", "green"), activity("d", "yellow")]);
    expect(screen.getByText("2 aktiviteter mangler folk")).toBeTruthy();
    expect(screen.queryByText("Alle oppgaver er dekket for planlagte aktiviteter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vis dem →" }));
    expect(filter()).toBe("red");
  });

  test("er alle spurt, men ikke alle har svart, sier den at den venter på svar", () => {
    show([activity("a", "yellow"), activity("b", "green")]);
    expect(screen.getByText("Venter på svar på 1 aktivitet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vis dem →" }));
    expect(filter()).toBe("yellow");
  });

  test("er alt dekket, er linjen grønn", () => {
    show([activity("a", "green"), activity("b", "green")]);
    expect(screen.getByText("Alle oppgaver er dekket for planlagte aktiviteter")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vis dem →" })).toBeNull();
  });

  test("har noen meldt forfall, er det det linjen sier, som før", () => {
    show([activity("a", "red", [{ status: "vacant" }]), activity("b", "red")]);
    expect(screen.getByText("1 oppgave trenger oppfølging / vikar")).toBeTruthy();
    expect(screen.queryByText(/mangler folk$/)).toBeNull();
  });

  test("filteret bruker de samme ordene som kortene", () => {
    show([activity("a", "red")]);
    const options = [...(document.getElementById("select-group-filter-status") as HTMLSelectElement).options].map((option) => option.textContent);
    expect(options).toEqual(["Alle statuser", "🔴 Mangler / Forfall", "🟡 Venter på svar", "🟢 Fullt dekket"]);
  });
});
