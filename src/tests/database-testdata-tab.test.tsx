// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DatabaseTestdataTab } from "../components/admin/DatabaseTestdataTab";
import * as testdataService from "../services/testdataService";

// Mock FirebaseDataContext
vi.mock("../context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    isFirestoreConnected: true,
    allPersons: [
      { id: "p1", name: "Kari Nordmann" },
      { id: "p2", name: "Ola Hansen" },
    ],
    groups: [
      { id: "g1", name: "Stab" },
      { id: "g2", name: "Menighetsråd" },
    ],
  }),
}));

// Mock testdataService functions
vi.spyOn(testdataService, "clearPlannerTestData").mockResolvedValue({
  success: true,
  counts: { persons: 2, groups: 2 },
  total: 4,
  failures: [],
});

vi.spyOn(testdataService, "generateTestdata").mockResolvedValue({
  success: true,
  counts: { persons: 32, groups: 12 },
  total: 44,
  failures: [],
});

vi.spyOn(testdataService, "deletePersonsTestdata").mockResolvedValue({
  success: true,
  counts: { persons: 2 },
  total: 2,
  failures: [],
});

vi.spyOn(testdataService, "deleteGroupsTestdata").mockResolvedValue({
  success: true,
  counts: { groups: 2 },
  total: 2,
  failures: [],
});

vi.spyOn(testdataService, "deleteRolesTestdata").mockResolvedValue({
  success: true,
  counts: { assignments: 4 },
  total: 4,
  failures: [],
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DatabaseTestdataTab Component med testdataService", () => {
  test("inneholder tre kontrollere med glidebrytere (0-100) for Personer, Grupper og Roller", () => {
    render(<DatabaseTestdataTab />);

    // Kontroller 1: Personer (0-100)
    const personerSlider = document.getElementById("personer-slider") as HTMLInputElement;
    expect(personerSlider).toBeDefined();
    expect(personerSlider.min).toBe("0");
    expect(personerSlider.max).toBe("100");
    expect(personerSlider.value).toBe("32");

    // Kontroller 2: Grupper (0-100)
    const grupperSlider = document.getElementById("grupper-slider") as HTMLInputElement;
    expect(grupperSlider).toBeDefined();
    expect(grupperSlider.min).toBe("0");
    expect(grupperSlider.max).toBe("100");
    expect(grupperSlider.value).toBe("14");

    // Kontroller 3: Roller (0-100)
    const rollerSlider = document.getElementById("roller-slider") as HTMLInputElement;
    expect(rollerSlider).toBeDefined();
    expect(rollerSlider.min).toBe("0");
    expect(rollerSlider.max).toBe("100");
    expect(rollerSlider.value).toBe("14");
  });

  test("inneholder en avkrysningsboks for 'Tøm eksisterende testdata' som er standard valgt", () => {
    render(<DatabaseTestdataTab />);

    const checkbox = screen.getByLabelText(/Tøm eksisterende testdata/i) as HTMLInputElement;
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBe(true);
  });

  test("inneholder en stor 'Populer database'-knapp som kaller testdataService for å generere 32 testpersoner", async () => {
    const showFeedbackMock = vi.fn();
    render(<DatabaseTestdataTab showFeedback={showFeedbackMock} />);

    const populateButton = screen.getByRole("button", { name: /Populer database/i });
    expect(populateButton).toBeDefined();
    fireEvent.click(populateButton);

    await waitFor(() => {
      // 1. Verifiser at eksisterende data nullstilles via testdataService
      expect(testdataService.clearPlannerTestData).toHaveBeenCalledTimes(1);
      // 2. Verifiser at testdataService.generateTestdata kalles for å generere 32 testpersoner
      expect(testdataService.generateTestdata).toHaveBeenCalledWith({
        personCount: 32,
        groupCount: 14,
        roleCount: 14,
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Testdata er lagt inn: personer, grupper og 12 tjenesteroller\. Nettsiden og de offentlige arrangementene er ikke rørt\./i)
      ).toBeDefined();
      expect(showFeedbackMock).toHaveBeenCalledWith(
        expect.stringContaining("12 tjenesteroller"),
        "success"
      );
    });
  });

  test("demo-samlingene er et eget valg som står av, og følger bare med når det krysses av", async () => {
    render(<DatabaseTestdataTab />);

    const checkbox = screen.getByLabelText(/Ta med demo-samlinger og oppgaver/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /Populer database/i }));

    await waitFor(() => {
      expect(testdataService.generateTestdata).toHaveBeenCalledWith({
        personCount: 32,
        groupCount: 14,
        roleCount: 14,
        gatheringCount: 19,
        taskCount: 24,
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/demo-samlinger med oppgaver og 12 tjenesteroller/i)).toBeDefined();
    });
  });

  test("hopper over nullstilling av data hvis avkrysningsboksen fjernes", async () => {
    render(<DatabaseTestdataTab />);

    const checkbox = screen.getByLabelText(/Tøm eksisterende testdata/i) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    const populateButton = screen.getByRole("button", { name: /Populer database/i });
    fireEvent.click(populateButton);

    await waitFor(() => {
      expect(testdataService.clearPlannerTestData).not.toHaveBeenCalled();
      expect(testdataService.generateTestdata).toHaveBeenCalledTimes(1);
    });
  });

  test("støtter målrettet sletting av kun personer, kun grupper og kun roller via service-modulen", async () => {
    render(<DatabaseTestdataTab />);

    const deletePersonsBtn = screen.getByRole("button", { name: /Slett kun personer/i });
    fireEvent.click(deletePersonsBtn);
    await waitFor(() => {
      expect(testdataService.deletePersonsTestdata).toHaveBeenCalledTimes(1);
    });

    const deleteGroupsBtn = screen.getByRole("button", { name: /Slett kun grupper/i });
    fireEvent.click(deleteGroupsBtn);
    await waitFor(() => {
      expect(testdataService.deleteGroupsTestdata).toHaveBeenCalledTimes(1);
    });

    const deleteRolesBtn = screen.getByRole("button", { name: /Slett roller & oppgaver/i });
    fireEvent.click(deleteRolesBtn);
    await waitFor(() => {
      expect(testdataService.deleteRolesTestdata).toHaveBeenCalledTimes(1);
    });
  });
});
