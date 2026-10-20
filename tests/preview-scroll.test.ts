// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { coveredTop, scrollToPreviewTarget } from "../src/utils/previewScroll";

const box = (element: Element, top: number, height: number, width = 1024) => {
  element.getBoundingClientRect = () => ({ top, bottom: top + height, height, width, left: 0, right: width, x: 0, y: top, toJSON() {} }) as DOMRect;
};
const add = (html: string) => {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const element = holder.firstElementChild!;
  document.body.appendChild(element);
  return element as HTMLElement;
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Forhåndsvisningen hopper til en seksjon", () => {
  test("menyen som står fast øverst, regnes med", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const nav = add('<nav style="position: fixed"></nav>');
    box(nav, 0, 65);
    expect(coveredTop()).toBe(65);
  });

  test("en åpen nedtrekksmeny, et sidepanel eller en linje lenger nede regnes ikke med", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    box(add('<nav style="position: fixed"></nav>'), 0, 600);
    box(add('<div class="fixed" style="position: fixed"></div>'), 0, 100, 300);
    box(add('<header style="position: sticky"></header>'), 200, 60);
    box(add('<header style="position: static"></header>'), 0, 90);
    expect(coveredTop()).toBe(0);
  });

  test("seksjonen legges rett under menyen, med luft over, og ikke bak den", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 1000, configurable: true });
    box(add('<nav style="position: fixed"></nav>'), 0, 65);
    const section = add("<section></section>");
    box(section, 2000, 400);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    scrollToPreviewTarget(section);
    // 3000 from the top of the page, less the menu and 16 px of air
    expect(scrollTo).toHaveBeenCalledWith({ top: 3000 - 65 - 16, behavior: "smooth" });
  });
});
