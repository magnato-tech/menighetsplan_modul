// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";
import type { Gathering } from "../src/types";

// «Hva skjer» on a page: how many events, which ones, how they are laid out and what each card says,
// and the picture and text of each event filled in from the module without leaving the page.

const { planner } = vi.hoisted(() => ({
  planner: { gatherings: [] as unknown[], groups: [] as unknown[], updateGathering: vi.fn(() => ({ success: true })) },
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: { ...demoCmsSettings, churchName: "Menigheten" }, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], gatheringsReady: true, ...planner }),
}));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
vi.mock("../src/demo", () => ({ DEMO: null }));

import { CalendarModule } from "../src/components/cms/modules/CalendarModule";
import { ModulePresentationEditor } from "../src/components/admin/ModulePresentationEditor";
import { MODULE_PRESENTATION_DEFAULTS } from "../src/utils/modulePresentation";
import { revealClassOf, whatsOnGatherings, whatsOnGroupIds, whatsOnOptionsOf } from "../src/utils/whatsOn";

const SLOW = { timeout: 8000 };
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const inDays = (days: number) => new Date(now + days * DAY).toISOString();

const event = (id: string, days: number, fields: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "g-alle",
  title: `Arrangement ${id}`,
  startsAt: inDays(days),
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: false,
  ...fields,
});

const nine = Array.from({ length: 9 }, (_, i) => event(`e${i + 1}`, i + 1));
const ids = (list: Gathering[]) => list.map((g) => g.id);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  planner.gatherings = [];
  planner.groups = [];
});

describe("Hvilke arrangementer «Hva skjer» viser", () => {
  test("uten valg er det som før: de fire neste offentlige", () => {
    const options = whatsOnOptionsOf({});
    expect(options).toEqual({ count: 4, selection: "all", groupId: "", layout: "grid", showSummary: true, showLocation: true, showTime: true, motion: "fade", fallbackImage: "" });
    expect(ids(whatsOnGatherings(nine, now, options))).toEqual(["e1", "e2", "e3", "e4"]);
  });

  test("antallet kan være 3, 4, 6 eller 8, og et annet tall gir 4", () => {
    expect(whatsOnGatherings(nine, now, whatsOnOptionsOf({ count: "8" }))).toHaveLength(8);
    expect(whatsOnGatherings(nine, now, whatsOnOptionsOf({ count: "3" }))).toHaveLength(3);
    expect(whatsOnOptionsOf({ count: "5" }).count).toBe(4);
  });

  test("interne, avsluttede og gruppesamlinger er aldri med", () => {
    const list = [
      event("intern", 1, { visibility: "intern", isPublic: false }),
      event("forbi", -2),
      event("gruppe", 2, { type: "gruppesamling" }),
      event("ok", 3),
    ];
    expect(ids(whatsOnGatherings(list, now, whatsOnOptionsOf({})))).toEqual(["ok"]);
  });

  test("bare gudstjenester, bare fremhevede, eller én gruppe", () => {
    const list = [
      event("gudstjeneste", 1, { isGudstjeneste: true }),
      event("fremhevet", 2, { visibility: "fremhevet" }),
      event("ungdom", 3, { groupId: "g-ungdom" }),
      event("annet", 4),
    ];
    expect(ids(whatsOnGatherings(list, now, whatsOnOptionsOf({ selection: "worship" })))).toEqual(["gudstjeneste"]);
    expect(ids(whatsOnGatherings(list, now, whatsOnOptionsOf({ selection: "featured" })))).toEqual(["fremhevet"]);
    expect(ids(whatsOnGatherings(list, now, whatsOnOptionsOf({ selection: "group", groupId: "g-ungdom" })))).toEqual(["ungdom"]);
    // A group not yet picked shows nothing, rather than every event
    expect(whatsOnGatherings(list, now, whatsOnOptionsOf({ selection: "group" }))).toEqual([]);
  });

  test("bare grupper med offentlige arrangementer framover kan velges", () => {
    const list = [event("a", 1, { groupId: "g-ungdom" }), event("b", 2, { groupId: "g-ungdom" }), event("c", -1, { groupId: "g-gammel" }), event("d", 1, { groupId: "g-intern", visibility: "intern", isPublic: false })];
    expect(whatsOnGroupIds(list, now)).toEqual(["g-ungdom"]);
  });
});

describe("Slik «Hva skjer» ser ut på nettsiden", () => {
  const vis = (config: Record<string, string> = {}) => {
    planner.gatherings = nine.map((g) => ({ ...g, summary: `Om ${g.id}`, location: "Kirkesalen" }));
    return render(
      <MemoryRouter>
        <CalendarModule presentation={{ ...MODULE_PRESENTATION_DEFAULTS["module-calendar"], ...config }} />
      </MemoryRouter>
    );
  };

  test("en side lagret før valgene fantes, får rutenettet med fire kort", () => {
    const { container } = render(
      <MemoryRouter>
        <CalendarModule presentation={{ title: "", backgroundImage: "", backgroundColor: "" }} />
      </MemoryRouter>
    );
    expect(container.querySelector("[data-whats-on-layout]")).toBeNull(); // no events yet
    cleanup();
    const view = vis();
    expect(view.container.querySelector('[data-whats-on-layout="grid"]')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-whats-on-card="card"]')).toHaveLength(4);
  });

  test("liste, karusell som kan blas, og ett stort med resten små", () => {
    let view = vis({ layout: "list", count: "6" });
    expect(view.container.querySelectorAll('[data-whats-on-card="row"]')).toHaveLength(6);
    cleanup();

    view = vis({ layout: "carousel" });
    expect(view.container.querySelector('[data-whats-on-layout="carousel"]')!.className).toContain("overflow-x-auto");
    expect(screen.getByLabelText("Neste arrangementer")).toBeTruthy();
    cleanup();

    view = vis({ layout: "feature" });
    expect(view.container.querySelectorAll('[data-whats-on-card="large"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-whats-on-card="row"]')).toHaveLength(3);
  });

  test("ingressen, klokkeslettet og stedet kan tas bort hver for seg", () => {
    let view = vis();
    expect(view.container.textContent).toContain("Om e1");
    expect(view.container.textContent).toContain("Kirkesalen");
    expect(view.container.textContent).toContain("Kl.");
    cleanup();
    view = vis({ showSummary: "off", showLocation: "off", showTime: "off" });
    expect(view.container.textContent).not.toContain("Om e1");
    expect(view.container.textContent).not.toContain("Kirkesalen");
    expect(view.container.textContent).not.toContain("Kl.");
  });
});

describe("«Hva skjer» i redigeringen av en side", () => {
  const rediger = (config: Record<string, string> = {}, onChange = vi.fn()) =>
    render(
      <MemoryRouter>
        <ModulePresentationEditor
          moduleType="module-calendar"
          config={{ ...MODULE_PRESENTATION_DEFAULTS["module-calendar"], ...config }}
          onChange={onChange}
          onSave={vi.fn()}
        />
      </MemoryRouter>
    );

  test("valgene står der, og gruppen velges bare når utvalget er én gruppe", () => {
    planner.gatherings = [event("a", 1, { groupId: "g-ungdom" })];
    planner.groups = [{ id: "g-ungdom", name: "Ungdom" }, { id: "g-intern", name: "Kjøkken" }];
    const onChange = vi.fn();
    const view = rediger({}, onChange);
    expect(view.getByLabelText("Antall arrangementer")).toBeTruthy();
    expect(view.getByLabelText("Oppsett")).toBeTruthy();
    expect(view.queryByLabelText(/^Gruppe/)).toBeNull();
    fireEvent.click(view.getByLabelText("Vis sted"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showLocation: "off" }));
    cleanup();

    const withGroup = rediger({ selection: "group" });
    const group = withGroup.getByLabelText(/^Gruppe/) as HTMLSelectElement;
    expect([...group.options].map((option) => option.textContent)).toEqual(["Velg gruppe", "Ungdom"]);
  });

  test(
    "arrangementene som vises, står med det de mangler, og Bilde og tekst lagrer på arrangementet uten å lagre siden",
    async () => {
      planner.gatherings = [event("a", 1, { title: "Gudstjeneste & kirkelunsj" }), event("b", 2, { title: "Basar", imageUrl: "https://example.org/b.jpg", summary: "Kom!" })];
      const savePage = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <MemoryRouter>
          <form onSubmit={savePage}>
            <ModulePresentationEditor moduleType="module-calendar" config={{ ...MODULE_PRESENTATION_DEFAULTS["module-calendar"] }} onChange={vi.fn()} onSave={vi.fn()} />
          </form>
        </MemoryRouter>
      );
      const list = document.querySelector("[data-whats-on-events]") as HTMLElement;
      const rows = within(list).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(rows[0].textContent).toContain("Mangler bilde og tekst");
      expect(rows[1].textContent).toContain("Har bilde og tekst");

      fireEvent.click(within(rows[0]).getByText("Bilde og tekst"));
      expect(await screen.findByText("Rediger arrangement")).toBeTruthy();
      fireEvent.click(screen.getByText("Lagre endringer"));
      await waitFor(() => expect(planner.updateGathering).toHaveBeenCalledWith("a", expect.any(Object)));
      expect(savePage).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText("Rediger arrangement")).toBeNull());
    },
    SLOW.timeout
  );
});

describe("Bevegelse og standardbilde i «Hva skjer»", () => {
  test("kortene kan tone inn, gli inn, zoome inn eller stå stille", () => {
    expect(revealClassOf("fade")).toBe("reveal-children");
    expect(revealClassOf("slide")).toBe("reveal-children reveal-slide");
    expect(revealClassOf("zoom")).toBe("reveal-children reveal-zoom");
    expect(revealClassOf("none")).toBe("");
    expect(whatsOnOptionsOf({ motion: "spinn" }).motion).toBe("fade");
  });

  test("et arrangement uten bilde får standardbildet, et med bilde beholder sitt", () => {
    planner.gatherings = [event("a", 1), event("b", 2, { imageUrl: "https://example.org/eget.jpg" })];
    const { container } = render(
      <MemoryRouter>
        <CalendarModule presentation={{ ...MODULE_PRESENTATION_DEFAULTS["module-calendar"], fallbackImage: "https://example.org/standard.jpg", motion: "none" }} />
      </MemoryRouter>
    );
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(["https://example.org/standard.jpg", "https://example.org/eget.jpg"]);
    expect(container.querySelector("[data-whats-on-layout]")!.className).not.toContain("reveal-children");
  });
});
