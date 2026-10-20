// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { PageMenuBar } from "../src/pages/admin/tabs/pages/PageMenuBar";

// The test browser does not scroll, so these check what makes the bars stay at the top: the window is
// what scrolls in admin, and the bars stand below the demo strip.
describe("Det som skal stå øverst i admin når man ruller", () => {
  test("innholdet i admin ruller ikke for seg selv, så linjene kan stå fast i vinduet", () => {
    const source = readFileSync("src/pages/admin/AdminStudio.tsx", "utf8");
    const main = source.slice(source.indexOf("<main"), source.indexOf(">", source.indexOf("className=", source.indexOf("<main"))));
    expect(main).not.toMatch(/overflow-(y-)?(auto|scroll|hidden)/);
  });

  test("sidemenyen i admin står fast ved siden av innholdet på store skjermer, og ruller for seg selv hvis den er høyere enn skjermen", () => {
    const source = readFileSync("src/pages/admin/StudioSidebar.tsx", "utf8");
    expect(source).toContain("md:sticky md:self-start md:h-[calc(100vh-var(--demo-strip,0px))]");
    expect(source).not.toContain("md:static");
  });

  test("menylinjen i Sider står under demo-stripen", () => {
    const { container } = render(
      <PageMenuBar items={[]} activeId={null} onJump={vi.fn()} onCollapseAll={vi.fn()} onExpandAll={vi.fn()} canFold={false} />
    );
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("top-[var(--demo-strip,0px)]");
  });

  test("over redigeringen ligger menylinjen over linjen med Lagre, så undermenyene ikke skjules bak den", () => {
    const { container } = render(<PageMenuBar items={[]} activeId={null} onJump={vi.fn()} sticky={false} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).not.toContain("sticky");
    // The editor's own line is z-30; the demo strip, which must stay on top, is z-[45]
    expect(bar.className).toContain("z-40");
    expect(readFileSync("src/pages/admin/tabs/pages/PageEditModal.tsx", "utf8")).toContain("sticky top-[var(--demo-strip,0px)] z-30");
  });

  test("en side man hopper til, legger seg under menylinjen, ikke bak den", () => {
    const source = readFileSync("src/pages/admin/tabs/pages/PageTreeList.tsx", "utf8");
    expect(source).not.toContain("scroll-mt-20");
    expect(source.split("scroll-mt-[calc(var(--demo-strip,0px)+4.5rem)]").length - 1).toBe(2);
  });
});
