/**
 * How far down the top of the window is covered by bars that stay put while the page scrolls: the
 * website's menu, and the demo strip in the demo. Only bars across most of the width, at the very top
 * and lower than half the window count, so an open drop-down or a side panel does not.
 */
export function coveredTop(doc: Document = document, win: Window = window): number {
  let covered = 0;
  doc.querySelectorAll<HTMLElement>("header, nav, [class*='sticky'], [class*='fixed']").forEach((element) => {
    const position = win.getComputedStyle(element).position;
    if (position !== "fixed" && position !== "sticky") return;
    const rect = element.getBoundingClientRect();
    if (rect.top > 1 || rect.height <= 0 || rect.height > win.innerHeight / 2 || rect.width < win.innerWidth / 2) return;
    covered = Math.max(covered, rect.bottom);
  });
  return covered;
}

/**
 * Scrolls the preview so a section the editor has picked starts just below the menu, with some air
 * above it, instead of with its top hidden behind the menu.
 */
export function scrollToPreviewTarget(target: Element, doc: Document = document, win: Window = window, gap = 16): void {
  const top = target.getBoundingClientRect().top + win.scrollY - coveredTop(doc, win) - gap;
  win.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
