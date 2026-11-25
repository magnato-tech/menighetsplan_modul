// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { InstallationSurfaces } from "../src/utils/surfaces";

// «Kalender for medlemmene» in the admin's Kalender tab: the address of the public calendar file,
// the sentence about Min side, and the copy button. The context is replaced; the address is the real one.

const { cms } = vi.hoisted(() => ({ cms: { surfaces: {} as Partial<InstallationSurfaces> } }));

vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ surfaces: cms.surfaces }) }));

import { MemberCalendarLinkPanel } from "../src/components/admin/MemberCalendarLinkPanel";

const MIN_SIDE_SENTENCE = "Knappene står også under Kalender på Min side.";

describe("Kalender for medlemmene i admin", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    cleanup();
  });

  test("viser adressen som slutter på /api/offentlig/kalender.ics", () => {
    cms.surfaces = { minSide: false };
    render(<MemberCalendarLinkPanel />);
    const input = screen.getByLabelText("Adressen til kalenderen") as HTMLInputElement;
    expect(input.value).toMatch(/\/api\/offentlig\/kalender\.ics$/);
    expect(input.readOnly).toBe(true);
  });

  test("setningen om Min side vises bare når minSide er true", () => {
    cms.surfaces = { minSide: true };
    const { unmount } = render(<MemberCalendarLinkPanel />);
    expect(screen.getByText(/Knappene står også under Kalender på Min side/)).toBeTruthy();
    unmount();

    cms.surfaces = { minSide: false };
    render(<MemberCalendarLinkPanel />);
    expect(screen.queryByText(new RegExp(MIN_SIDE_SENTENCE))).toBeNull();
  });

  test("«Kopier» kopierer adressen og bekrefter det", async () => {
    cms.surfaces = { minSide: false };
    render(<MemberCalendarLinkPanel />);
    const input = screen.getByLabelText("Adressen til kalenderen") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Kopier" }));
    expect(writeText).toHaveBeenCalledWith(input.value);
    expect(await screen.findByText("Adressen er kopiert.")).toBeTruthy();
  });
});
