// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HeroBackdrop } from "../src/components/public/HeroBackdrop";
import { PublicNavbar } from "../src/components/public/PublicNavbar";
import { PublicHomePage } from "../src/pages/public/PublicHomePage";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { CMS_PREVIEW_TARGET_HERO } from "../src/utils/cmsBlocks";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";

const { home } = vi.hoisted(() => ({
  home: {
    id: "page-forside",
    slug: "",
    title: "Forside",
    summary: "Åpent hjerte for Gud og medmennesker",
    content: "",
    isPublished: true,
    inNavMenu: true,
    linkUrl: "/",
    parentId: null,
    navOrder: 1,
    updatedAt: "2026-10-06T12:00:00.000Z",
    heroImage: "https://example.org/ett.jpg",
  } as CmsPage,
}));
const omOss: CmsPage = { id: "page-om-oss", slug: "om-oss", title: "Om oss", summary: "", content: "Tekst", isPublished: true, inNavMenu: true, parentId: null, navOrder: 2, updatedAt: "2026-10-06T12:00:00.000Z" };

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: { ...demoCmsSettings, churchName: "Søgne Misjonskirke" },
    pages: [home, omOss],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage: vi.fn(),
    getPageBySlug: (slug: string) => (slug === "" || slug === "forside" ? home : slug === "om-oss" ? omOss : undefined),
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "member" },
    setCurrentUserId: vi.fn(),
    getUserGroups: () => [],
    getTasksForPerson: () => [],
    allPersons: [],
    gatherings: [],
    groups: [],
  }),
}));
vi.mock("../src/components/UserSwitcher", () => ({ UserSwitcher: () => null }));

const reducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};
const tre = ["https://example.org/ett.jpg", "https://example.org/to.jpg", "https://example.org/tre.jpg"];
const synlig = (root: ParentNode) => [...root.querySelectorAll("img")].filter((img) => img.className.includes("opacity-100")).map((img) => img.getAttribute("src"));

beforeEach(() => {
  reducedMotion(false);
  home.heroImages = undefined;
  home.heroImageTitles = undefined;
  home.heroArrows = undefined;
  home.heroZoom = undefined;
  home.heroMenuOverlay = undefined;
  home.heroMenuStyle = undefined;
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toppbildet", () => {
  test("ett bilde vises stille med rolig zoom, og zoomen kan slås av", () => {
    const { container, rerender } = render(<HeroBackdrop images={[tre[0]]} alt="Kirken ved sjøen" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("Kirken ved sjøen");
    expect(img.className).toContain("hero-zoom");

    rerender(<HeroBackdrop images={[tre[0]]} zoom={false} />);
    expect(container.querySelector("img")!.className).not.toContain("hero-zoom");
  });

  test("uten bilde tegnes ingenting", () => {
    const { container } = render(<HeroBackdrop images={[]} />);
    expect(container.innerHTML).toBe("");
  });

  test("flere bilder toner fra det ene til det neste og begynner forfra", () => {
    vi.useFakeTimers();
    const { container } = render(<HeroBackdrop images={tre} secondsPerImage={8} />);
    expect(synlig(container)).toEqual([tre[0]]);

    act(() => void vi.advanceTimersByTime(8000));
    expect(synlig(container)).toEqual([tre[1]]);
    // The image on its way out keeps its zoom while it fades, so it does not jump back to size
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs[0].className).toContain("hero-zoom");
    expect(imgs[1].className).toContain("hero-zoom");
    expect(imgs[2].className).not.toContain("hero-zoom");
    // Only the image on show is read out or reachable
    expect(imgs.map((img) => img.getAttribute("aria-hidden"))).toEqual(["true", null, "true"]);

    act(() => void vi.advanceTimersByTime(16000));
    expect(synlig(container)).toEqual([tre[0]]);
  });

  test("den som har bedt om mindre bevegelse, får ett stillestående bilde", () => {
    vi.useFakeTimers();
    reducedMotion(true);
    const { container } = render(<HeroBackdrop images={tre} secondsPerImage={8} />);
    act(() => void vi.advanceTimersByTime(60000));
    expect(synlig(container)).toEqual([tre[0]]);
  });

  test("forsiden viser hovedbildet og de ekstra toppbildene, høyst tre", () => {
    render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroImages: [tre[1], tre[2], "https://example.org/fire.jpg"] }} />
      </MemoryRouter>
    );
    const hero = document.querySelector(`[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"]`)!;
    expect([...hero.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(tre);
    expect(hero.className).toContain("min-h-[72vh]");
  });

  test("forsiden uten toppbilde er som før: ingen bilder og ingen ekstra høyde", () => {
    render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroImage: "" }} />
      </MemoryRouter>
    );
    const hero = document.querySelector(`[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"]`)!;
    expect(hero.querySelector("img")).toBeNull();
    expect(hero.className).not.toContain("min-h-[72vh]");
  });
});

describe("Valgene for toppbildet på forsiden", () => {
  const hero = () => document.querySelector(`[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"]`)!;
  const vis = (page: Partial<CmsPage>) =>
    render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, ...page }} />
      </MemoryRouter>
    );

  test("et lavt toppbilde gir plass til innholdet under, og hele skjermen fyller den", () => {
    vis({ heroHeight: "low" });
    expect(hero().className).toContain("min-h-[50vh]");
    cleanup();
    vis({ heroHeight: "full" });
    expect(hero().className).toContain("min-h-[100svh]");
  });

  test("en rolig tittel er tynnere og mindre enn den kraftige", () => {
    vis({ heroTitleStyle: "calm" });
    const h1 = hero().querySelector("h1")!;
    expect(h1.className).toContain("font-normal");
    expect(h1.className).not.toContain("font-black");
  });

  test("uten slør står bildet rent, og teksten får skygge så den kan leses", () => {
    vis({ heroVeil: "none" });
    expect(hero().querySelector('[data-hero-backdrop] div[class*="bg-gradient"]')).toBeNull();
    expect(hero().querySelector("h1")!.className).toContain("text-shadow");
  });

  test("tittelen har fire størrelser, og følger stilen til en er valgt", () => {
    vis({});
    expect(hero().querySelector("h1")!.className).toContain("lg:text-6xl");
    cleanup();
    vis({ heroTitleStyle: "calm" });
    expect(hero().querySelector("h1")!.className).toContain("lg:text-5xl");
    cleanup();
    vis({ heroTitleStyle: "calm", heroTitleSize: "xlarge" });
    expect(hero().querySelector("h1")!.className).toContain("lg:text-7xl");
    cleanup();
    vis({ heroTitleSize: "small" });
    expect(hero().querySelector("h1")!.className).toContain("lg:text-4xl");
  });

  test("bare den valgte skriften hentes, og overskriftenes egen henter ingen", () => {
    vis({});
    expect(hero().querySelector("style")).toBeNull();
    expect(hero().querySelector("h1")!.getAttribute("style") ?? "").not.toContain("font-family");
    cleanup();
    vis({ heroTitleFont: "script" });
    const css = hero().querySelector("style")!.textContent!;
    expect(css).toContain("/skrifter/caveat.woff2");
    expect(css).not.toContain("nunito");
    expect(hero().querySelector("h1")!.style.fontFamily).toContain("Caveat");
    cleanup();
    vis({ heroTitleFont: "caps" });
    expect(hero().querySelector("h1")!.className).toContain("uppercase");
  });

  test("undertittelen kan slås av, og da står det ingen tekst fra innstillingene heller", () => {
    vis({ showHeroSubtext: false });
    expect(hero().textContent).not.toContain(home.summary);
    expect(hero().querySelector("p")).toBeNull();
  });
});

describe("Flere toppbilder med hver sin tittel", () => {
  const hero = () => document.querySelector(`[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"]`)!;
  const vis = (page: Partial<CmsPage>) =>
    render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroTitle: "Velkommen", ...page }} />
      </MemoryRouter>
    );

  test("tittelen bytter sammen med bildet, og et bilde uten egen tittel viser hovedtittelen", () => {
    vi.useFakeTimers();
    vis({ heroImages: [tre[1], tre[2]], heroImageTitles: ["Søndag kl. 11", ""] });
    expect(hero().querySelector("h1")!.textContent).toBe("Velkommen");
    act(() => void vi.advanceTimersByTime(8000));
    expect(synlig(hero())).toEqual([tre[1]]);
    expect(hero().querySelector("h1")!.textContent).toBe("Søndag kl. 11");
    act(() => void vi.advanceTimersByTime(8000));
    expect(hero().querySelector("h1")!.textContent).toBe("Velkommen");
  });

  test("prikkene under bildet lar den besøkende bla selv", () => {
    vis({ heroImages: [tre[1], tre[2]], heroImageTitles: ["Søndag kl. 11", "Bli med"] });
    const dots = [...hero().querySelectorAll("[data-hero-dots] button")];
    expect(dots).toHaveLength(3);
    expect(dots[0].getAttribute("aria-current")).toBe("true");
    fireEvent.click(dots[2]);
    expect(synlig(hero())).toEqual([tre[2]]);
    expect(hero().querySelector("h1")!.textContent).toBe("Bli med");
    expect(hero().querySelector("[data-hero-dots] button[aria-current]")!.getAttribute("aria-label")).toBe("Bilde 3 av 3");
  });

  test("pilene er et valg, og går rundt", () => {
    vis({ heroImages: [tre[1]] });
    expect(hero().querySelector('[aria-label="Neste bilde"]')).toBeNull();
    cleanup();
    vis({ heroImages: [tre[1]], heroArrows: true });
    fireEvent.click(hero().querySelector('[aria-label="Forrige bilde"]')!);
    expect(synlig(hero())).toEqual([tre[1]]);
    fireEvent.click(hero().querySelector('[aria-label="Neste bilde"]')!);
    expect(synlig(hero())).toEqual([tre[0]]);
  });

  test("med ett bilde er det verken prikker eller piler", () => {
    vis({ heroArrows: true });
    expect(hero().querySelector("[data-hero-dots]")).toBeNull();
    expect(hero().querySelector('[aria-label="Neste bilde"]')).toBeNull();
  });
});

describe("Menyen oppå toppbildet", () => {
  const meny = (path: string) => {
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <PublicNavbar />
      </MemoryRouter>
    );
    return container.querySelector("header")!;
  };

  test("på forsiden ligger menyen gjennomsiktig over bildet, og blir hvit når man scroller", () => {
    const header = meny("/");
    expect(header.getAttribute("data-menu-on-hero")).toBe("true");
    expect(header.className).toContain("fixed");
    expect(header.className).not.toContain("bg-white");

    Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
    fireEvent.scroll(window);
    expect(header.getAttribute("data-menu-on-hero")).toBeNull();
    expect(header.className).toContain("bg-white/95");
    // Still fixed, so the page does not jump when the bar changes
    expect(header.className).toContain("fixed");
  });

  test("på andre sider er menyen den vanlige hvite linjen", () => {
    const header = meny("/om-oss");
    expect(header.getAttribute("data-menu-on-hero")).toBeNull();
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("bg-white/95");
  });

  test("uten toppbilde, eller når det er slått av på forsiden, er menyen som før", () => {
    home.heroMenuOverlay = false;
    expect(meny("/").className).toContain("sticky");
    cleanup();

    home.heroMenuOverlay = undefined;
    const bilde = home.heroImage;
    home.heroImage = "";
    expect(meny("/").className).toContain("sticky");
    home.heroImage = bilde;
  });

  test("forhåndsvisningen i redigeringen viser menyen som nettsiden, men ikke forhåndsvisningen i egen fane", () => {
    expect(meny("/?preview=true&embedded=1").className).toContain("fixed");
    cleanup();
    expect(meny("/?preview=true").className).toContain("sticky");
  });

  test("menyen kan ligge helt uten bakgrunn over bildet, eller som hvit linje", () => {
    home.heroMenuStyle = "clear";
    const header = meny("/");
    expect(header.className).toContain("bg-transparent");
    expect(header.className).not.toContain("bg-gradient-to-b");
    cleanup();
    home.heroMenuStyle = "white";
    expect(meny("/").className).toContain("sticky");
    home.heroMenuStyle = undefined;
  });

  test("når mobilmenyen åpnes, blir linjen hvit så punktene kan leses", () => {
    const header = meny("/");
    fireEvent.click(header.querySelector('button[aria-label="Åpne meny"]')!);
    expect(header.getAttribute("data-menu-on-hero")).toBeNull();
    expect(header.className).toContain("bg-white/95");
  });
});

describe("Toppbildet i redigeringen", () => {
  const rediger = (page: Partial<CmsPage>, onUpdate = vi.fn()) => {
    const view = render(
      <MemoryRouter>
        <PageEditModal editingPage={page} isNewPage={false} availableParentPages={[]} onUpdate={onUpdate} onSave={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    );
    return { ...view, onUpdate };
  };

  test("forsiden har valgene for zoom, meny og slør, som før til de endres", () => {
    const { getByLabelText, onUpdate } = rediger(home);
    const zoom = getByLabelText("Rolig zoom på toppbildet") as HTMLInputElement;
    const menu = getByLabelText("Menyen øverst") as HTMLSelectElement;
    const veil = getByLabelText("Slør over bildet") as HTMLSelectElement;
    expect(zoom.checked).toBe(true);
    expect(menu.value).toBe("shade");
    expect(veil.value).toBe("dark");

    fireEvent.click(zoom);
    expect(onUpdate).toHaveBeenCalledWith({ heroZoom: false });
    fireEvent.change(menu, { target: { value: "white" } });
    expect(onUpdate).toHaveBeenCalledWith({ heroMenuStyle: "white", heroMenuOverlay: false });
    fireEvent.change(veil, { target: { value: "none" } });
    expect(onUpdate).toHaveBeenCalledWith({ heroVeil: "none" });
  });

  test("et toppbilde får eget tittelfelt, og tittelen følger bildet når et bilde foran tas ut", () => {
    const { getByLabelText, onUpdate } = rediger({ ...home, heroImages: [tre[1], tre[2]], heroImageTitles: ["Søndag", "Bli med"] });
    fireEvent.change(getByLabelText("Tittel på toppbilde 2"), { target: { value: "Søndag kl. 11" } });
    expect(onUpdate).toHaveBeenCalledWith({ heroImageTitles: ["Søndag kl. 11", "Bli med"] });
    fireEvent.change(getByLabelText("Tekststørrelse på tittelen"), { target: { value: "xlarge" } });
    expect(onUpdate).toHaveBeenCalledWith({ heroTitleSize: "xlarge" });
    fireEvent.change(getByLabelText("Skrift på tittelen"), { target: { value: "serif" } });
    expect(onUpdate).toHaveBeenCalledWith({ heroTitleFont: "serif" });
    fireEvent.click(getByLabelText("Piler på sidene av bildet"));
    expect(onUpdate).toHaveBeenCalledWith({ heroArrows: true });
  });

  test("en vanlig side har ikke disse valgene", () => {
    const { queryByLabelText, queryByText } = rediger(omOss);
    expect(queryByLabelText("Rolig zoom på toppbildet")).toBeNull();
    expect(queryByText("Flere toppbilder og bevegelse")).toBeNull();
  });
});
