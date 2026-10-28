// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GatheringNotes } from "../src/components/gathering/GatheringNotes";
import { gatheringNoteDocId, gatheringNoteFields, gatheringNoteOf, hasNoteText, isGatheringNotePlace } from "../src/utils/gatheringNote";

// Notes on a gathering: one document in cms_settings per gathering, read with one get. The administrator
// writes them, a leader reads them.

const firestore = vi.hoisted(() => ({
  stored: undefined as Record<string, unknown> | undefined,
  setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
  getDoc: vi.fn(),
}));

vi.mock("../src/firebase", () => ({ db: { kind: "db" } }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collectionName: string, id: string) => ({ path: `${collectionName}/${id}` }),
  getDoc: (ref: unknown) => firestore.getDoc(ref),
  setDoc: (ref: unknown, data: unknown) => firestore.setDoc(ref as never, data as never),
}));

import { getWriteError, clearWriteError } from "../src/services/writeErrors";
import { readGatheringNote, saveGatheringNote } from "../src/services/gatheringNotes";

beforeEach(() => {
  firestore.stored = undefined;
  firestore.setDoc.mockClear();
  firestore.getDoc.mockReset();
  firestore.getDoc.mockImplementation(async (ref: { path: string }) => ({
    exists: () => firestore.stored !== undefined,
    data: () => firestore.stored,
    ref,
  }));
  clearWriteError();
});
afterEach(() => cleanup());

describe("Notatet på et arrangement i databasen", () => {
  test("lagres under én id per arrangement, i cms_settings, med merket gatheringNote", async () => {
    const ok = await saveGatheringNote({ gatheringId: "g1", text: "  Husk stolene  ", updatedAt: "2026-11-01T10:00:00.000Z", updatedByName: "Magnar" });
    expect(ok).toBe(true);
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = firestore.setDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe(`cms_settings/${gatheringNoteDocId("g1")}`);
    expect(gatheringNoteDocId("g1")).toBe("gathering-note-g1");
    expect(data).toEqual({ recordType: "gatheringNote", gatheringId: "g1", text: "Husk stolene", updatedAt: "2026-11-01T10:00:00.000Z", updatedByName: "Magnar" });
  });

  test("les med ett dokument: det som står, eller et tomt notat når ingenting er lagret", async () => {
    firestore.stored = { recordType: "gatheringNote", gatheringId: "g1", text: "Ta med noter", updatedAt: "2026-11-01T10:00:00.000Z", updatedByName: "Magnar" };
    expect((await readGatheringNote("g1")).text).toBe("Ta med noter");
    expect(firestore.getDoc).toHaveBeenLastCalledWith({ path: "cms_settings/gathering-note-g1" });

    firestore.stored = undefined;
    expect(await readGatheringNote("g2")).toEqual({ gatheringId: "g2", text: "", updatedAt: "", updatedByName: "" });
  });

  test("et dokument av en annen art, eller for et annet arrangement, er et tomt notat", () => {
    expect(gatheringNoteOf("g1", { recordType: "gatheringTemplate", gatheringId: "g1", text: "x" }).text).toBe("");
    expect(gatheringNoteOf("g1", { recordType: "gatheringNote", gatheringId: "g2", text: "x" }).text).toBe("");
  });

  test("en skriving som feiler, meldes og gir false", async () => {
    firestore.setDoc.mockRejectedValueOnce(new Error("permission-denied"));
    const ok = await saveGatheringNote({ gatheringId: "g1", text: "x", updatedAt: "2026-11-01T10:00:00.000Z", updatedByName: "Magnar" });
    expect(ok).toBe(false);
    expect(getWriteError()?.action).toBe("lagre notatet");
  });

  test("et tomt notat er ikke tekst, og lagres som tomt", () => {
    expect(hasNoteText("   \n ")).toBe(false);
    expect(hasNoteText("x")).toBe(true);
    expect(gatheringNoteFields({ gatheringId: "g1", text: "  ", updatedAt: "", updatedByName: "" }).text).toBe("");
  });

  test("et notat blir ikke slettet av nullstillingen av demoen, mens andre dokumenter i samme samling blir det", () => {
    expect(isGatheringNotePlace("cms_settings/gathering-note-g1")).toBe(true);
    expect(isGatheringNotePlace("sogne-cms_settings/gathering-note-g1")).toBe(true);
    expect(isGatheringNotePlace("cms_settings/global")).toBe(false);
    expect(isGatheringNotePlace("cms_pages/gathering-note-g1")).toBe(false);
  });
});

describe("Notater-raden på arrangementet", () => {
  test("er lukket først, med prikk når det står tekst", async () => {
    firestore.stored = { recordType: "gatheringNote", gatheringId: "g1", text: "Husk stolene", updatedAt: "x", updatedByName: "Magnar" };
    render(<GatheringNotes gatheringId="g1" canEdit={false} authorName="Magnar" />);
    const toggle = await screen.findByRole("button", { name: /Notater.*har innhold/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("gathering-notes-panel")).toBeNull();
  });

  test("uten tekst er det ingen prikk", async () => {
    render(<GatheringNotes gatheringId="g2" canEdit={false} authorName="Magnar" />);
    await waitFor(() => expect(firestore.getDoc).toHaveBeenCalled());
    const toggle = screen.getByRole("button", { name: "Notater" });
    expect(toggle.textContent).toBe("Notater");
  });

  test("en leder ser teksten, men ikke et felt å skrive i", async () => {
    firestore.stored = { recordType: "gatheringNote", gatheringId: "g1", text: "Husk stolene", updatedAt: "x", updatedByName: "Magnar" };
    render(<GatheringNotes gatheringId="g1" canEdit={false} authorName="Kari" />);
    fireEvent.click(await screen.findByRole("button", { name: /Notater/ }));
    expect(document.getElementById("gathering-notes-panel")?.textContent).toContain("Husk stolene");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lagre" })).toBeNull();
  });

  test("en administrator skriver og lagrer med Lagre", async () => {
    firestore.stored = { recordType: "gatheringNote", gatheringId: "g1", text: "Husk stolene", updatedAt: "x", updatedByName: "Magnar" };
    render(<GatheringNotes gatheringId="g1" canEdit={true} authorName="Magnar" />);
    fireEvent.click(await screen.findByRole("button", { name: /Notater/ }));
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(field.value).toBe("Husk stolene");
    fireEvent.change(field, { target: { value: "Husk stolene og mikrofonen" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    await waitFor(() => expect(firestore.setDoc).toHaveBeenCalledTimes(1));
    const [, data] = firestore.setDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    expect(data.text).toBe("Husk stolene og mikrofonen");
    expect(data.updatedByName).toBe("Magnar");
  });

  test("Ctrl+S lagrer også", async () => {
    render(<GatheringNotes gatheringId="g3" canEdit={true} authorName="Magnar" />);
    fireEvent.click(await screen.findByRole("button", { name: /Notater/ }));
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "Nytt" } });
    fireEvent.keyDown(field, { key: "s", ctrlKey: true });
    await waitFor(() => expect(firestore.setDoc).toHaveBeenCalledTimes(1));
  });

  test("teksten skrives ut, uten fold, i en blokk som bare vises på papir", async () => {
    firestore.stored = { recordType: "gatheringNote", gatheringId: "g1", text: "Husk stolene", updatedAt: "x", updatedByName: "Magnar" };
    const { container } = render(<GatheringNotes gatheringId="g1" canEdit={false} authorName="Kari" />);
    await screen.findByRole("button", { name: /Notater/ });
    const printed = container.querySelector(".print\\:block");
    expect(printed?.textContent).toContain("Husk stolene");
    expect(printed?.className).toContain("hidden");
  });

  test("ingen tekst, ingen utskriftsblokk", async () => {
    const { container } = render(<GatheringNotes gatheringId="g2" canEdit={false} authorName="Kari" />);
    await waitFor(() => expect(firestore.getDoc).toHaveBeenCalled());
    expect(container.querySelector(".print\\:block")).toBeNull();
  });
});
