// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { useRevealChildren } from "../src/hooks/useRevealChildren";
import { NewsModule } from "../src/components/cms/modules/NewsModule";
import { CalendarModule } from "../src/components/cms/modules/CalendarModule";
import { demoCmsSettings, type CmsNewsArticle } from "../src/data/cmsData";
import type { Gathering } from "../src/types";

const news: CmsNewsArticle[] = ["Første", "Andre", "Tredje"].map((title, i) => ({
  id: `news-${i}`, title, slug: `nyhet-${i}`, summary: "", content: "Tekst", category: "aktuelt",
  author: "Menigheten", publishedAt: `2026-10-0${i + 1}T12:00:00.000Z`, isPublished: true,
}));
const gatherings: Gathering[] = [1, 2].map((n) => ({
  id: `g${n}`, groupId: "g", title: `Samling ${n}`, startsAt: `2099-01-0${n}T10:00:00.000Z`, visibility: "offentlig", type: "arrangement",
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: { ...demoCmsSettings }, pages: [], media: [], news, sermons: [], staff: [] }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => ({ gatherings, groups: [], allPersons: [] }) }));

/** A stand-in for the browser's watcher: the test decides which cards have come into view. */
class Watcher {
  static last: Watcher | null = null;
  watched = new Set<Element>();
  constructor(private report: (entries: { target: Element; isIntersecting: boolean }[]) => void) { Watcher.last = this; }
  observe(el: Element) { this.watched.add(el); }
  unobserve(el: Element) { this.watched.delete(el); }
  disconnect() { this.watched.clear(); }
  show(...els: Element[]) { this.report(els.map((target) => ({ target, isIntersecting: true }))); }
}
const withWatcher = () => { (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = Watcher; };

const List: React.FC<{ items: string[] }> = ({ items }) => {
  const ref = useRevealChildren<HTMLUListElement>(items.length);
  return <ul ref={ref} className="reveal-children">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
};
const revealed = (root: ParentNode) => [...root.querySelectorAll("[data-revealed]")].map((el) => el.textContent);

afterEach(() => {
  cleanup();
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  Watcher.last = null;
});

describe("Kort som toner inn når de kommer til syne", () => {
  test("uten støtte i nettleseren vises alle kortene med en gang, og listen holdes aldri tilbake", () => {
    const { container } = render(<List items={["a", "b"]} />);
    expect(revealed(container)).toEqual(["a", "b"]);
    expect(container.querySelector("ul")!.hasAttribute("data-reveal-ready")).toBe(false);
  });

  test("kortene holdes tilbake til de kommer til syne, og kommer etter hverandre", () => {
    withWatcher();
    const { container } = render(<List items={["a", "b", "c"]} />);
    const [a, b, c] = [...container.querySelectorAll("li")];
    expect(container.querySelector("ul")!.getAttribute("data-reveal-ready")).toBe("true");
    expect(revealed(container)).toEqual([]);

    act(() => Watcher.last!.show(a, b));
    expect(revealed(container)).toEqual(["a", "b"]);
    expect([a.style.animationDelay, b.style.animationDelay]).toEqual(["0ms", "90ms"]);
    // A card that has appeared is not watched any more, so it never plays twice
    expect([...Watcher.last!.watched]).toEqual([c]);
  });

  test("kort som kommer til senere, fanges opp uten at de som er vist, spilles på nytt", () => {
    withWatcher();
    const { container, rerender } = render(<List items={["a"]} />);
    act(() => Watcher.last!.show(container.querySelector("li")!));

    rerender(<List items={["a", "b"]} />);
    expect(revealed(container)).toEqual(["a"]);
    expect([...Watcher.last!.watched].map((el) => el.textContent)).toEqual(["b"]);
  });

  test("sier nettleseren ingenting om kortene, vises de alle etter en kort stund", () => {
    vi.useFakeTimers();
    withWatcher();
    const { container } = render(<List items={["a", "b"]} />);
    act(() => void vi.advanceTimersByTime(2900));
    expect(revealed(container)).toEqual([]);
    act(() => void vi.advanceTimersByTime(200));
    expect(revealed(container)).toEqual(["a", "b"]);
    vi.useRealTimers();
  });

  test("har nettleseren meldt fra, venter kortene nedenfor til de kommer til syne", () => {
    vi.useFakeTimers();
    withWatcher();
    const { container } = render(<List items={["a", "b"]} />);
    act(() => Watcher.last!.show(container.querySelector("li")!));
    act(() => void vi.advanceTimersByTime(10000));
    expect(revealed(container)).toEqual(["a"]);
    vi.useRealTimers();
  });

  test("nyhetskortene og kalenderkortene på forsiden bruker innfasingen", () => {
    withWatcher();
    const { container } = render(
      <MemoryRouter>
        <NewsModule />
        <CalendarModule />
      </MemoryRouter>
    );
    const lists = [...container.querySelectorAll(".reveal-children")];
    expect(lists.map((list) => list.children.length)).toEqual([3, 2]);
    expect(lists.every((list) => list.getAttribute("data-reveal-ready") === "true")).toBe(true);
  });

  test("stilarket holder bare tilbake kort i en liste som er tatt hånd om, og slår av bevegelsen for dem som ber om det", () => {
    // Tests run from the project root
    const css = readFileSync("src/index.css", "utf8");
    expect(css).toContain(".reveal-children[data-reveal-ready] > :not([data-revealed])");
    expect(css).not.toMatch(/\.reveal-children\s*>\s*:not\(\[data-revealed\]\)/);
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("opacity: 1");
    expect(reduced).toContain("animation: none");
  });
});
