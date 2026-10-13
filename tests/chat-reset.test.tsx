// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// The administrator empties the group chats, before a new season: all of them, or one group's.

const service = vi.hoisted(() => ({
  counts: { hus: 5, lyd: 2 } as Record<string, number>,
  countGroupMessages: vi.fn(async () => ({}) as Record<string, number>),
  deleteGroupMessages: vi.fn(async (_groupId: string | null) => 0),
}));
vi.mock("../src/services/chatReset", () => ({ countGroupMessages: service.countGroupMessages, deleteGroupMessages: service.deleteGroupMessages }));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ groups: [{ id: "lyd", name: "Lyd og bilde" }, { id: "hus", name: "Husgruppe 1" }, { id: "tom", name: "Rigging" }] }),
}));

import { ChatResetPanel } from "../src/components/admin/ChatResetPanel";

const showFeedback = vi.fn();
const show = () => render(<ChatResetPanel showFeedback={showFeedback} />);
const choice = () => screen.getByLabelText("Hvilken chat") as HTMLSelectElement;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  service.counts = { hus: 5, lyd: 2 };
});

describe("Nullstill gruppechat", () => {
  test("viser hvor mange meldinger det gjelder, for alle og for hver gruppe som har noen", async () => {
    service.countGroupMessages.mockImplementation(async () => service.counts);
    show();
    await screen.findByLabelText("Hvilken chat");
    expect([...choice().options].map((option) => option.textContent)).toEqual(["Alle gruppene (7 meldinger)", "Husgruppe 1 (5 meldinger)", "Lyd og bilde (2 meldinger)"]);
    expect(service.deleteGroupMessages).not.toHaveBeenCalled();
  });

  test("ingenting slettes før det er bekreftet, og «Avbryt» lar alt stå", async () => {
    service.countGroupMessages.mockImplementation(async () => service.counts);
    show();
    await screen.findByLabelText("Hvilken chat");
    fireEvent.click(screen.getByRole("button", { name: "Nullstill …" }));
    const question = screen.getByRole("alertdialog");
    expect(question.textContent).toContain("Slette 7 meldinger i alle gruppene? Deltakerne ser en tom chat etterpå. Det kan ikke angres.");
    expect(service.deleteGroupMessages).not.toHaveBeenCalled();
    fireEvent.click(within(question).getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(service.deleteGroupMessages).not.toHaveBeenCalled();
  });

  test("én gruppes chat kan nullstilles for seg", async () => {
    service.countGroupMessages.mockImplementation(async () => service.counts);
    service.deleteGroupMessages.mockImplementation(async (groupId) => {
      const deleted = service.counts[groupId ?? ""] ?? 0;
      service.counts = { lyd: 2 };
      return deleted;
    });
    show();
    await screen.findByLabelText("Hvilken chat");
    fireEvent.change(choice(), { target: { value: "hus" } });
    fireEvent.click(screen.getByRole("button", { name: "Nullstill …" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("Slette 5 meldinger i «Husgruppe 1»?");
    fireEvent.click(screen.getByRole("button", { name: "Ja, slett meldingene" }));

    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("5 meldinger i «Husgruppe 1» er slettet."));
    expect(service.deleteGroupMessages).toHaveBeenCalledWith("hus");
    // The numbers are counted again, and the group that is emptied, is no longer among the choices
    await waitFor(() => expect([...choice().options].map((option) => option.textContent)).toEqual(["Alle gruppene (2 meldinger)", "Lyd og bilde (2 meldinger)"]));
  });

  test("alle gruppenes chat nullstilles med null som gruppe, og etterpå er det ingenting å nullstille", async () => {
    service.countGroupMessages.mockImplementation(async () => service.counts);
    service.deleteGroupMessages.mockImplementation(async () => {
      service.counts = {};
      return 7;
    });
    show();
    await screen.findByLabelText("Hvilken chat");
    fireEvent.click(screen.getByRole("button", { name: "Nullstill …" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, slett meldingene" }));
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("7 meldinger i alle gruppene er slettet."));
    expect(service.deleteGroupMessages).toHaveBeenCalledWith(null);
    expect(await screen.findByText("Ingen gruppe har meldinger i chatten.")).toBeTruthy();
  });

  test("går slettingen ikke, sies det fra", async () => {
    service.countGroupMessages.mockImplementation(async () => service.counts);
    service.deleteGroupMessages.mockRejectedValueOnce(new Error("Missing or insufficient permissions."));
    show();
    await screen.findByLabelText("Hvilken chat");
    fireEvent.click(screen.getByRole("button", { name: "Nullstill …" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, slett meldingene" }));
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith(expect.stringContaining("Meldingene kunne ikke slettes"), "error"));
  });
});
