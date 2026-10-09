// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { initialPersons, initialGroups } from "../src/data/mockData";
import { initialCmsPages } from "../src/data/cmsData";
import { CONTENT_BLOCKS } from "../src/pages/admin/tabs/pages/ContentBlockPickerModal";
import { parseCmsContent, CmsContentRenderer } from "../src/components/cms/CmsContentRenderer";
import { toPublicProfile } from "../src/utils/publicProfile";

afterEach(() => {
  cleanup();
});

// Mock FirebaseDataContext for CmsContentRenderer
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    allPersons: initialPersons,
    groups: initialGroups,
    currentUser: initialPersons[0],
    updatePerson: vi.fn(),
  }),
}));

describe("Stab og Lederskap: Datamodell og Demodata", () => {
  test("Kari Nordmann er registrert som ansatt pastor med bilde og samtykke", () => {
    const kari = initialPersons.find((p) => p.id === "person-1");
    expect(kari).toBeDefined();
    expect(kari?.isStaff).toBe(true);
    expect(kari?.staffRole).toBe("Hovedpastor");
    expect(kari?.staffCategory).toBe("pastor");
    expect(kari?.avatarUrl).toBeTruthy();
    expect(kari?.isPublicProfile).toBe(true);
    expect(kari?.consentToPublishGivenAt).toBeTruthy();

    const publicProfile = toPublicProfile(kari!);
    expect(publicProfile).not.toBeNull();
    expect(publicProfile?.name).toBe("Kari Nordmann");
    expect(publicProfile?.title).toBe("Hovedpastor");
    expect(publicProfile?.avatarUrl).toBe(kari?.avatarUrl);
  });

  test("Ola Hansen er registrert som ansatt daglig leder med bilde og samtykke", () => {
    const ola = initialPersons.find((p) => p.id === "person-2");
    expect(ola).toBeDefined();
    expect(ola?.isStaff).toBe(true);
    expect(ola?.staffRole).toBe("Daglig leder & Koordinator");
    expect(ola?.staffCategory).toBe("stab");
    expect(ola?.avatarUrl).toBeTruthy();
    expect(ola?.isPublicProfile).toBe(true);
    expect(ola?.consentToPublishGivenAt).toBeTruthy();

    const publicProfile = toPublicProfile(ola!);
    expect(publicProfile).not.toBeNull();
    expect(publicProfile?.name).toBe("Ola Hansen");
    expect(publicProfile?.title).toBe("Daglig leder & Koordinator");
  });

  test("Ingrid Berg er ansatt barneleder, men mangler samtykke og skal IKKE publiseres (GDPR-vern)", () => {
    const ingrid = initialPersons.find((p) => p.id === "person-3");
    expect(ingrid).toBeDefined();
    expect(ingrid?.isStaff).toBe(true);
    expect(ingrid?.staffRole).toBe("Barne- og Ungdomsarbeider");
    expect(ingrid?.staffCategory).toBe("barneleder");
    expect(ingrid?.avatarUrl).toBeTruthy();

    // Ingen samtykke gitt
    const publicProfile = toPublicProfile(ingrid!);
    expect(publicProfile).toBeNull();
  });

  test("Jonas Lie er ikke ansatt stab, men leder menighetsrådet med samtykke", () => {
    const jonas = initialPersons.find((p) => p.id === "person-4");
    expect(jonas).toBeDefined();
    expect(jonas?.isStaff).toBe(false);
    expect(jonas?.isPublicProfile).toBe(true);

    const publicProfile = toPublicProfile(jonas!);
    expect(publicProfile).not.toBeNull();
    expect(publicProfile?.title).toBe("Leder i menighetsrådet");

    const leadershipGroup = initialGroups.find((g) => g.id === "group-lederskap");
    expect(leadershipGroup).toBeDefined();
    expect(leadershipGroup?.category).toBe("ledergruppe");
    expect(leadershipGroup?.leaderIds).toContain("person-4");
    expect(leadershipGroup?.deputyLeaderIds).toContain("person-1");
  });
});

describe("CMS Parser: parseCmsContent for personblokker", () => {
  test("parser :::personer[stab] til person-grid blokk med filter 'stab'", () => {
    const blocks = parseCmsContent(":::personer[stab]");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "person-grid",
      filter: "stab",
    });
  });

  test("parser :::personer[lederskap] til person-grid blokk med filter 'lederskap'", () => {
    const blocks = parseCmsContent(":::personer[lederskap]");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "person-grid",
      filter: "lederskap",
    });
  });

  test("parser :::personer[pastor] og :::personer[kategori=pastor]", () => {
    const blocks1 = parseCmsContent(":::personer[pastor]");
    expect(blocks1[0]).toEqual({ type: "person-grid", filter: "pastor" });

    const blocks2 = parseCmsContent(":::personer[kategori=pastor]");
    expect(blocks2[0]).toEqual({ type: "person-grid", filter: "kategori=pastor" });
  });

  test("parser spesifikke person-ID-er :::personer[person-1,person-2]", () => {
    const blocks = parseCmsContent(":::personer[person-1,person-2]");
    expect(blocks[0]).toEqual({ type: "person-grid", filter: "person-1,person-2" });
  });

  test("parser snarveiene :::stab og :::lederskap", () => {
    const blocksStab = parseCmsContent(":::stab");
    expect(blocksStab[0]).toEqual({ type: "person-grid", filter: "stab" });

    const blocksLederskap = parseCmsContent(":::lederskap");
    expect(blocksLederskap[0]).toEqual({ type: "person-grid", filter: "lederskap" });
  });

  test("bevarer overskrifter og brødtekst sammen med personblokken", () => {
    const content = `## Våre ansatte
Velkommen til oss. Her er staben vår:

:::personer[stab]

Ta gjerne kontakt om du lurer på noe.`;

    const blocks = parseCmsContent(content);
    expect(blocks.some((b) => b.type === "heading" && b.text === "Våre ansatte")).toBe(true);
    expect(blocks.some((b) => b.type === "paragraph" && b.text.includes("Velkommen"))).toBe(true);
    expect(blocks.some((b) => b.type === "person-grid" && b.filter === "stab")).toBe(true);
    expect(blocks.some((b) => b.type === "paragraph" && b.text.includes("Ta gjerne kontakt"))).toBe(true);
  });
});

describe("Innholdsblokk-velger: CONTENT_BLOCKS", () => {
  test("inneholder definisjon for Stab & Ansatte", () => {
    const block = CONTENT_BLOCKS.find((b) => b.id === "personer-stab");
    expect(block).toBeDefined();
    expect(block?.category).toBe("Personer & Roller");
    expect(block?.template).toBe(":::personer[stab]");
  });

  test("inneholder definisjon for Menighetsråd & Lederskap", () => {
    const block = CONTENT_BLOCKS.find((b) => b.id === "personer-lederskap");
    expect(block).toBeDefined();
    expect(block?.category).toBe("Personer & Roller");
    expect(block?.template).toBe(":::personer[lederskap]");
  });

  test("inneholder definisjon for Kun Pastor / Forkynnere", () => {
    const block = CONTENT_BLOCKS.find((b) => b.id === "personer-pastor");
    expect(block).toBeDefined();
    expect(block?.category).toBe("Personer & Roller");
    expect(block?.template).toBe(":::personer[pastor]");
  });
});

describe("CmsContentRenderer: Visning på nettsiden", () => {
  test("rendrer stabsseksjonen :::personer[stab] med Kari og Ola, men skjuler Ingrid (mangler samtykke)", () => {
    render(
      <MemoryRouter>
        <CmsContentRenderer content=":::personer[stab]" />
      </MemoryRouter>
    );

    // Kari Nordmann (pastor) skal vises
    expect(screen.getByText("Kari Nordmann")).toBeDefined();
    expect(screen.getByText("Hovedpastor")).toBeDefined();

    // Ola Hansen (daglig leder) skal vises
    expect(screen.getByText("Ola Hansen")).toBeDefined();
    expect(screen.getByText(/Daglig leder/)).toBeDefined();

    // Ingrid Berg skal IKKE vises fordi hun mangler samtykke
    expect(screen.queryByText("Ingrid Berg")).toBeNull();

    // Offentlig kontaktinfo vises
    expect(screen.getByText("pastor@fjordvik.example")).toBeDefined();
    expect(screen.getByText("37 00 00 01")).toBeDefined();
  });

  test("rendrer kun pastoren ved :::personer[pastor]", () => {
    render(
      <MemoryRouter>
        <CmsContentRenderer content=":::personer[pastor]" />
      </MemoryRouter>
    );

    expect(screen.getByText("Kari Nordmann")).toBeDefined();
    expect(screen.queryByText("Ola Hansen")).toBeNull();
    expect(screen.queryByText("Ingrid Berg")).toBeNull();
  });

  test("rendrer menighetsrådet ved :::personer[lederskap] med roller", () => {
    render(
      <MemoryRouter>
        <CmsContentRenderer content=":::personer[lederskap]" />
      </MemoryRouter>
    );

    // Jonas Lie er leder
    expect(screen.getByText("Jonas Lie")).toBeDefined();
    expect(screen.getByText("Leder i menighetsrådet")).toBeDefined();

    // Kari Nordmann er nestleder
    expect(screen.getByText("Kari Nordmann")).toBeDefined();
  });

  test("rendrer spesifikke håndplukkede personer ved :::personer[person-1]", () => {
    render(
      <MemoryRouter>
        <CmsContentRenderer content=":::personer[person-1]" />
      </MemoryRouter>
    );

    expect(screen.getByText("Kari Nordmann")).toBeDefined();
    expect(screen.queryByText("Ola Hansen")).toBeNull();
    expect(screen.queryByText("Jonas Lie")).toBeNull();
  });
});

describe("CMS Sider: Struktur for Stab og Lederskap", () => {
  test("siden 'Stab' eksisterer under 'Om menigheten' med blokk :::personer[stab]", () => {
    const stabPage = initialCmsPages.find((p) => p.slug === "stab");
    expect(stabPage).toBeDefined();
    expect(stabPage?.title).toBe("Stab");
    expect(stabPage?.parentId).toBe("page-om-oss");
    expect(stabPage?.content).toContain(":::personer[stab]");
    expect(stabPage?.isPublished).toBe(true);
    expect(stabPage?.inNavMenu).toBe(true);
  });

  test("siden 'Lederskap' eksisterer under 'Om menigheten' med blokk :::personer[lederskap]", () => {
    const lederskapPage = initialCmsPages.find((p) => p.slug === "lederskap");
    expect(lederskapPage).toBeDefined();
    expect(lederskapPage?.title).toBe("Lederskap");
    expect(lederskapPage?.parentId).toBe("page-om-oss");
    expect(lederskapPage?.content).toContain(":::personer[lederskap]");
    expect(lederskapPage?.isPublished).toBe(true);
    expect(lederskapPage?.inNavMenu).toBe(true);
  });
});
