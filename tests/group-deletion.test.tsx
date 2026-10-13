// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Group } from "../src/types";
import { groupDeletion } from "../src/utils/groupDeletion";

// Deleting a group: what it means is said before anything is deleted, and a group that owns
// events or tasks is not deleted at all.

const traces = vi.hoisted(() => ({ read: vi.fn(async (_groupId: string) => ({ messages: 0, proposals: 0 })) }));
vi.mock("../src/services/groupDeletion", () => ({ readGroupTraces: traces.read }));

import { DeleteGroupDialog } from "../src/pages/admin/DeleteGroupDialog";

const group: Group = { id: "gjester", name: "Gjestetalere", memberIds: ["p1", "p2"], leaderIds: ["p2"], deputyLeaderIds: ["p3"] };
const nothing = { gatherings: [], tasks: [], roles: [], templates: [] };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Hva det betyr å slette en gruppe", () => {
  test("en gruppe uten arrangementer og oppgaver kan slettes, og deltakerne telles én gang", () => {
    const deletion = groupDeletion(group, nothing);
    expect(deletion.blockedBy).toEqual([]);
    expect(deletion.participants).toBe(3);
  });

  test("en gruppe med arrangementer eller oppgaver kan ikke slettes før de er flyttet", () => {
    const deletion = groupDeletion(group, {
      ...nothing,
      gatherings: [{ groupId: "gjester" }, { groupId: "gjester" }, { groupId: "annen" }],
      tasks: [{ groupId: "gjester" }, { groupId: "annen" }],
    });
    expect(deletion.blockedBy).toEqual([
      "2 arrangementer ligger på denne gruppen. Flytt dem til en annen gruppe, eller slett dem, først.",
      "1 oppgave i kjøreplanene hører til denne gruppen. Gi den et annet tjenesteteam, eller slett den, først.",
    ]);
  });

  test("gruppen som holder kalenderen, er vernet av det samme: arrangementene ligger på den", () => {
    const calendar: Group = { id: "kalender", name: "Felleskalender", memberIds: [], leaderIds: [] };
    expect(groupDeletion(calendar, { ...nothing, gatherings: [{ groupId: "kalender" }] }).blockedBy).toHaveLength(1);
  });

  test("rollene og malene som peker på gruppen, er de som mister den", () => {
    const deletion = groupDeletion(group, {
      ...nothing,
      roles: [{ id: "r1", name: "Taler", groupId: "gjester" }, { id: "r2", name: "Lyd", groupId: "rigg" }, { id: "r3", name: "Leder" }],
      templates: [{ id: "m1", name: "Gudstjeneste" }, { id: "m2", name: "Temakveld", groupId: "gjester" }],
    });
    expect(deletion.roles).toEqual([{ id: "r1", name: "Taler" }]);
    expect(deletion.templates).toEqual([{ id: "m2", name: "Temakveld" }]);
  });
});

describe("Advarselen før en gruppe slettes", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const show = (deletion = groupDeletion(group, nothing)) => render(<DeleteGroupDialog groupId="gjester" groupName="Gjestetalere" deletion={deletion} onConfirm={onConfirm} onClose={onClose} />);

  test("sier hva som skjer med tall for gruppen, og at det ikke kan angres", async () => {
    traces.read.mockResolvedValueOnce({ messages: 12, proposals: 1 });
    show(groupDeletion(group, { ...nothing, roles: [{ id: "r1", name: "Taler", groupId: "gjester" }] }));
    const warning = screen.getByRole("alertdialog", { name: "Slette gruppen «Gjestetalere»?" });
    const list = within(warning).getByRole("list", { name: "Dette skjer" });
    await within(list).findByText("12 meldinger i gruppen slettes.");
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "3 personer er ikke lenger med i gruppen. Personene blir stående i registeret.",
      "12 meldinger i gruppen slettes.",
      "1 forslag om nye deltakere slettes.",
      "Rollen Taler står uten tjenesteteam etterpå.",
    ]);
    expect(within(warning).getByText("Det kan ikke angres.")).toBeTruthy();
    expect(traces.read).toHaveBeenCalledWith("gjester");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("«Avbryt» lar gruppen stå, og «Slett gruppen» sletter", async () => {
    show();
    await screen.findByText("Gruppen har ingen meldinger.");
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Slett gruppen" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("en gruppe med arrangementer får vite hva som må flyttes, og har ingen sletteknapp", async () => {
    show(groupDeletion(group, { ...nothing, gatherings: [{ groupId: "gjester" }] }));
    const warning = screen.getByRole("alertdialog", { name: "«Gjestetalere» kan ikke slettes ennå" });
    expect(within(warning).getByText("1 arrangement ligger på denne gruppen. Flytt det til en annen gruppe, eller slett det, først.")).toBeTruthy();
    expect(within(warning).queryByRole("button", { name: "Slett gruppen" })).toBeNull();
    expect(within(warning).queryByText("Det kan ikke angres.")).toBeNull();
    fireEvent.click(within(warning).getAllByRole("button", { name: "Lukk" })[1]);
    expect(onClose).toHaveBeenCalled();
  });

  test("får den ikke lest meldingene, sier den likevel at de slettes", async () => {
    traces.read.mockRejectedValueOnce(new Error("ingen forbindelse"));
    show();
    expect(await screen.findByText("Meldingene i gruppen slettes.")).toBeTruthy();
  });
});
