// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AttentionModal } from "../src/pages/myPage/AttentionModal";
import { attentionTagOf, attentionTags, withAttentionTags, type AttentionItem } from "../src/pages/myPage/attention";
import type { MyPageModel } from "../src/pages/myPage/useMyPage";

// A long list of what needs one's action, narrowed with tags: one for each role.

const open = (id: string, title: string, groupName: string): AttentionItem => ({ id, type: "open_task", taskId: id, title, groupName, startsAt: "2027-01-10T10:00:00.000Z", needsSubstitute: false });
const items: AttentionItem[] = [
  open("1", "Rigging", "Rigging"),
  open("2", "Lyd", "Rigging"),
  open("3", "Forbønn", "Forbedere"),
  open("4", "Rigging", "Rigging"),
  open("5", "Møteleder", "Gudstjenesteleder"),
  { id: "6", type: "task_request", assignmentId: "a6", title: "Lyd", groupName: "Rigging", startsAt: "2026-12-24T15:00:00.000Z" },
  { id: "7", type: "unanswered_invitation", gatheringId: "g7", title: "Husgruppe 1", groupName: "Husgruppe 1", startsAt: "2026-10-20T17:00:00.000Z" },
];

afterEach(cleanup);

describe("Taggene i «Dette trenger din handling»", () => {
  test("én for hver rolle det er en oppgave for, etter navn, med antall; innkallinger har sin egen", () => {
    expect(attentionTags(items)).toEqual([
      { tag: "Forbønn", count: 1 },
      { tag: "Innkalling", count: 1 },
      { tag: "Lyd", count: 2 },
      { tag: "Møteleder", count: 1 },
      { tag: "Rigging", count: 2 },
    ]);
    expect(attentionTagOf(items[6])).toBe("Innkalling");
    // A task is found by its role, also when the task has been given a title of its own
    expect(attentionTagOf({ ...items[1], title: "Lyd på julaften", role: "Lyd" })).toBe("Lyd");
    expect(attentionTagOf({ ...items[1], title: "Bake kake" })).toBe("Bake kake");
  });

  test("det som vises, har én av taggene som er trykket inn; uten noen vises alt", () => {
    expect(withAttentionTags(items, new Set())).toHaveLength(7);
    expect(withAttentionTags(items, new Set(["Lyd"])).map((item) => item.id)).toEqual(["2", "6"]);
    expect(withAttentionTags(items, new Set(["Lyd", "Forbønn", "Innkalling"])).map((item) => item.id)).toEqual(["2", "3", "6", "7"]);
  });
});

describe("Listen med tagger", () => {
  const handleAttentionAnswer = vi.fn();
  const show = (list = items) => render(<AttentionModal page={{ attentionItems: list, handleAttentionAnswer } as unknown as MyPageModel} onClose={() => {}} />);
  const tags = () => screen.getByRole("group", { name: "Vis bare disse" });
  const cards = () => screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);

  test("flere tagger kan trykkes inn, og alle som er trykket inn, vises", () => {
    show();
    // The request first, then the free tasks; the call stands on the page and is not repeated here
    expect(screen.getByRole("heading", { name: "Forespurte og ledige oppgaver (6)" })).toBeTruthy();
    expect(cards()).toHaveLength(6);
    expect(cards()[0]).toBe("Lyd");

    fireEvent.click(within(tags()).getByRole("button", { name: "Rigging 2" }));
    expect(cards()).toEqual(["Rigging", "Rigging"]);
    expect(screen.getByRole("heading", { name: "Forespurte og ledige oppgaver (2 av 6)" })).toBeTruthy();

    fireEvent.click(within(tags()).getByRole("button", { name: "Møteleder 1" }));
    expect(cards()).toEqual(["Rigging", "Rigging", "Møteleder"]);
    expect(within(tags()).getByRole("button", { name: "Rigging 2" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(tags()).getByRole("button", { name: "Lyd 2" }).getAttribute("aria-pressed")).toBe("false");

    // Pressed again, a tag comes out
    fireEvent.click(within(tags()).getByRole("button", { name: "Rigging 2" }));
    expect(cards()).toEqual(["Møteleder"]);
    fireEvent.click(within(tags()).getByRole("button", { name: "Vis alle" }));
    expect(cards()).toHaveLength(6);
    expect(within(tags()).queryByRole("button", { name: "Vis alle" })).toBeNull();
  });

  test("en oppgave tas fra den filtrerte listen som fra den hele", () => {
    show();
    fireEvent.click(within(tags()).getByRole("button", { name: "Forbønn 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Ta oppgave" }));
    expect(handleAttentionAnswer).toHaveBeenCalledWith(items[2], true);
  });

  test("med bare forespørsler heter listen Forespurte oppgaver", () => {
    show([items[5]]);
    expect(screen.getByRole("heading", { name: "Forespurte oppgaver (1)" })).toBeTruthy();
    expect(cards()).toEqual(["Lyd"]);
  });

  test("med bare én rolle er det ingenting å velge mellom, og taggene vises ikke", () => {
    show([items[0], items[3]]);
    expect(screen.queryByRole("group", { name: "Vis bare disse" })).toBeNull();
    expect(cards()).toHaveLength(2);
  });
});
