// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Group, Task } from "../src/types";
import { teamsOfTasks } from "../src/utils/gatheringMail";

// The message to the teams of a gathering: one text, sent to each chosen team once.

const sendGroupMessage = vi.hoisted(() => vi.fn(() => ({ success: true })));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => ({ sendGroupMessage }) }));

import { GatheringTeamMessageDialog } from "../src/components/gathering/GatheringTeamMessageDialog";

const groups: Pick<Group, "id" | "name">[] = [
  { id: "lyd", name: "Lyd og bilde" },
  { id: "kjokken", name: "Kjøkken" },
  { id: "tom", name: "Tomme team" },
];
const tasks: Pick<Task, "groupId">[] = [{ groupId: "lyd" }, { groupId: undefined }, { groupId: "kjokken" }, { groupId: "lyd" }, { groupId: "ukjent" }];

beforeEach(() => sendGroupMessage.mockClear());
afterEach(() => cleanup());

describe("Teamene på et arrangement", () => {
  test("hvert team en gang, i rekkefølgen oppgavene har det, uten oppgaver uten team og uten ukjente grupper", () => {
    expect(teamsOfTasks(tasks, groups)).toEqual([
      { groupId: "lyd", name: "Lyd og bilde" },
      { groupId: "kjokken", name: "Kjøkken" },
    ]);
  });
});

describe("Melding til teamene", () => {
  const teams = teamsOfTasks(tasks, groups);

  test("lister hvert team én gang med avkrysning, og alle er valgt fra start", () => {
    render(<GatheringTeamMessageDialog teams={teams} onSent={() => undefined} onClose={() => undefined} />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.closest("label")?.textContent)).toEqual(["Lyd og bilde", "Kjøkken"]);
    expect(boxes.every((box) => box.checked)).toBe(true);
  });

  test("et team som er tatt bort, får ingen melding", () => {
    const onSent = vi.fn();
    render(<GatheringTeamMessageDialog teams={teams} onSent={onSent} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Kjøkken" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Husk mikrofonen  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(sendGroupMessage).toHaveBeenCalledTimes(1);
    expect(sendGroupMessage).toHaveBeenCalledWith("lyd", "  Husk mikrofonen  ");
    expect(onSent).toHaveBeenCalledWith(1);
  });

  test("hvert valgt team får teksten én gang, og ingenting prefikses", () => {
    const onSent = vi.fn();
    render(<GatheringTeamMessageDialog teams={teams} onSent={onSent} onClose={() => undefined} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Møte kl. 10 i kirken" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(sendGroupMessage.mock.calls).toEqual([
      ["lyd", "Møte kl. 10 i kirken"],
      ["kjokken", "Møte kl. 10 i kirken"],
    ]);
    expect(onSent).toHaveBeenCalledWith(2);
  });

  test("uten tekst, eller uten valgte team, kan ikke sendes", () => {
    render(<GatheringTeamMessageDialog teams={teams} onSent={() => undefined} onClose={() => undefined} />);
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hei" } });
    expect(send.disabled).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Lyd og bilde" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Kjøkken" }));
    expect(send.disabled).toBe(true);
  });

  test("et arrangement uten team sier det, og kan ikke sende", () => {
    render(<GatheringTeamMessageDialog teams={[]} onSent={() => undefined} onClose={() => undefined} />);
    expect(screen.getByText("Arrangementet har ingen team ennå.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByRole("dialog")).queryAllByRole("checkbox")).toHaveLength(0);
  });
});
