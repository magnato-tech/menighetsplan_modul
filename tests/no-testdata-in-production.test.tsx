// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// A congregation's own app has no button that fills the register with made-up persons, and no hint to
// simulate a history: one press, or one misunderstanding, would put invented data among the real.

const { mode } = vi.hoisted(() => ({ mode: { value: "production" as "demo" | "production" | null } }));
vi.mock("../src/hooks/useOperatingMode", () => ({ useOperatingMode: () => mode.value }));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], groups: [], updatePerson: vi.fn() }),
}));

import { StaffTab } from "../src/pages/admin/tabs/StaffTab";
import { CoverageSection } from "../src/pages/admin/tabs/analytics/CoverageSection";

afterEach(cleanup);

describe("Ingen testdata i menighetens app", () => {
  test("Lederskap & Stab har ingen knapp som fyller inn testdata, heller ikke uten stab", () => {
    render(
      <MemoryRouter>
        <StaffTab showFeedback={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText("Lederskap & Stab")).toBeTruthy();
    expect(screen.queryByText(/testdata/i)).toBeNull();
    expect(screen.queryByText(/populer/i)).toBeNull();
  });

  test("datagrunnlaget nevner simulert menighetsliv bare i demo", () => {
    for (const value of ["production", null] as const) {
      mode.value = value;
      render(<CoverageSection coverage={[]} onOpenDatabase={vi.fn()} />);
      expect(screen.queryByText(/simulert halvår/)).toBeNull();
      cleanup();
    }
    mode.value = "demo";
    render(<CoverageSection coverage={[]} onOpenDatabase={vi.fn()} />);
    expect(screen.getByText(/simulert halvår/)).toBeTruthy();
  });
});
