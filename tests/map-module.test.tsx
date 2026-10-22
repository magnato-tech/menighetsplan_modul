// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";

// «Kart» on a page: the map is drawn from the stored position, the link opens the full map,
// and the editor finds the position from the typed address.

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], gatheringsReady: true, gatherings: [], groups: [] }),
}));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
vi.mock("../src/demo", () => ({ DEMO: null }));

import { MapModule } from "../src/components/cms/modules/MapModule";
import { ModulePresentationEditor } from "../src/components/admin/ModulePresentationEditor";
import { MODULE_PRESENTATION_DEFAULTS } from "../src/utils/modulePresentation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Kart på siden", () => {
  test("tegner kartet rundt den lagrede posisjonen og lenker til hele kartet", () => {
    const view = render(
      <MapModule
        variant="small"
        presentation={{ title: "Finn fram", address: "Storgata 1, Lillesand", lat: "58", lon: "8" }}
      />
    );
    const iframe = view.container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("title")).toBe("Kart: Storgata 1, Lillesand");
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe.getAttribute("loading")).toBe("lazy");

    const src = new URL(iframe.getAttribute("src") || "");
    expect(src.origin + src.pathname).toBe("https://www.openstreetmap.org/export/embed.html");
    expect(src.searchParams.get("marker")).toBe("58,8");
    const bbox = (src.searchParams.get("bbox") || "").split(",").map(Number);
    expect(bbox[0]).toBeCloseTo(7.99, 5);
    expect(bbox[1]).toBeCloseTo(57.994, 5);
    expect(bbox[2]).toBeCloseTo(8.01, 5);
    expect(bbox[3]).toBeCloseTo(58.006, 5);

    const link = view.getByText("Åpne i kart") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://www.openstreetmap.org/?mlat=58&mlon=8#map=16/58/8");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(view.container.textContent).toContain("Storgata 1, Lillesand");
  });

  test("uten posisjon vises bare adressen og en søkelenke, ikke et kart", () => {
    const view = render(
      <MapModule presentation={{ title: "Finn fram", address: "Storgata 1, Lillesand", lat: "", lon: "" }} />
    );
    expect(view.container.querySelector("iframe")).toBeNull();
    const link = view.getByText("Åpne i kart") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "https://www.openstreetmap.org/search?query=Storgata%201%2C%20Lillesand"
    );
    expect(view.container.textContent).toContain("Storgata 1, Lillesand");
  });

  test("ugyldige koordinater gir ikke kart, og uten adresse vises ingenting", () => {
    const bad = render(<MapModule presentation={{ address: "Storgata 1", lat: "abc", lon: "8" }} />);
    expect(bad.container.querySelector("iframe")).toBeNull();
    cleanup();

    const empty = render(<MapModule presentation={{ address: "  ", lat: "58", lon: "8" }} />);
    expect(empty.container.firstChild).toBeNull();
  });
});

describe("«Finn på kartet» i redigeringen", () => {
  const editor = (config: Record<string, string>, onChange = vi.fn()) =>
    render(
      <MemoryRouter>
        <ModulePresentationEditor
          moduleType="module-map"
          config={{ ...MODULE_PRESENTATION_DEFAULTS["module-map"], ...config }}
          onChange={onChange}
          onSave={vi.fn()}
        />
      </MemoryRouter>
    );

  test("slår opp adressen hos OpenStreetMap og lagrer posisjonen", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "58.1466", lon: "7.9956", display_name: "Storgata 1, Lillesand, Norge" }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    const view = editor({ address: "Storgata 1, Lillesand" }, onChange);

    fireEvent.click(view.getByText("Finn på kartet"));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lat: "58.1466", lon: "7.9956" }))
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Storgata%201%2C%20Lillesand"
    );
    expect(await view.findByText("Fant: Storgata 1, Lillesand, Norge")).toBeTruthy();
  });

  test("ved treff som ikke finnes, og ved feil, vises en melding og gamle koordinater fjernes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const onChange = vi.fn();
    const view = editor({ address: "Ingensteds", lat: "58", lon: "8" }, onChange);

    fireEvent.click(view.getByText("Finn på kartet"));
    expect(await view.findByText("Fant ikke adressen. Prøv med postnummer og sted.")).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lat: "", lon: "" }));
    cleanup();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("nettet er nede")));
    const failed = editor({ address: "Storgata 1" });
    fireEvent.click(failed.getByText("Finn på kartet"));
    expect(await failed.findByText("Fant ikke adressen. Prøv med postnummer og sted.")).toBeTruthy();
  });
});
