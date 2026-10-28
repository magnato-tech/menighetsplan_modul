// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RolesTab } from "../src/pages/admin/tabs/RolesTab";
import { DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS, DEFAULT_VOLUNTEER_ROLE_NAMES, rolesMissingStandardInstruction } from "../src/data/defaultVolunteerRoles";
import { StudioData } from "../src/pages/admin/studio";

const createVolunteerRole = vi.fn();
const updateVolunteerRole = vi.fn();
const deleteVolunteerRole = vi.fn();

const { persistVolunteerRole, patchVolunteerRole, removeVolunteerRole } = vi.hoisted(() => ({
  persistVolunteerRole: vi.fn(async (input: { name: string; instruction?: string }) => ({
    id: "role-new",
    name: input.name,
    instruction: input.instruction || "",
    sortOrder: 2,
  })),
  patchVolunteerRole: vi.fn(async () => undefined),
  removeVolunteerRole: vi.fn(async () => undefined),
}));

vi.mock("../src/services/volunteerRoles", () => ({
  seedDefaultVolunteerRoles: vi.fn(async () => []),
  persistVolunteerRole,
  patchVolunteerRole,
  removeVolunteerRole,
}));

const studio = {
  adminVolunteerRoles: [
    { id: "role-1", name: "Lyd", instruction: "Møt kl. 09:30", sortOrder: 0 },
    { id: "role-2", name: "Kjøkken", instruction: "", sortOrder: 1 },
  ],
  adminGroups: [
    {
      group: { id: "group-lyd", name: "Lyd og bilde", memberIds: [], leaderIds: [] },
      leaders: [],
      deputyLeaders: [],
      members: [],
      tasksCount: 0,
    },
  ],
  createVolunteerRole,
  updateVolunteerRole,
  deleteVolunteerRole,
} as unknown as StudioData;

afterEach(() => cleanup());

describe("RolesTab", () => {
  test("viser roller i et søkbart kortrutenett", () => {
    render(<RolesTab studio={studio} />);
    expect(screen.getByText("Lyd")).toBeTruthy();
    expect(screen.getByText("Kjøkken")).toBeTruthy();
    expect(screen.getByPlaceholderText("Søk i roller...")).toBeTruthy();
  });

  test("roller uten instruks kan få standardinstruksen, og de som har en, røres ikke", async () => {
    const showFeedback = vi.fn();
    const roles = [
      { id: "role-1", name: "Lyd", instruction: "Møt kl. 09:30", sortOrder: 0 },
      { id: "role-2", name: "kjøkken ", instruction: "  ", sortOrder: 1 },
      { id: "role-3", name: "Taler", sortOrder: 2 },
      { id: "role-4", name: "Parkeringsvakt", instruction: "", sortOrder: 3 },
    ];
    expect(rolesMissingStandardInstruction(roles).map(({ role }) => role.id)).toEqual(["role-2", "role-3"]);
    expect(rolesMissingStandardInstruction([roles[0], roles[3]])).toEqual([]);

    patchVolunteerRole.mockClear();
    render(<RolesTab studio={{ ...studio, adminVolunteerRoles: roles } as unknown as StudioData} showFeedback={showFeedback} />);
    expect(screen.getByText("2 roller kan få standardinstruksen")).toBeTruthy();
    expect(screen.getByText(/Gjelder kjøkken , Taler: de mangler instruks/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Legg inn standardinstrukser" }));

    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Standardinstruks er lagt inn på 2 roller."));
    expect(patchVolunteerRole.mock.calls).toEqual([
      ["role-2", { instruction: DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Kjøkken }],
      ["role-3", { instruction: DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Taler }],
    ]);
  });

  test("en eldre standardinstruks som står urørt, byttes ut; en tekst menigheten har endret, står", () => {
    // What the standard said for Møtevert before 13 October 2026
    const earlier = [
      "• Ønske velkommen i døra fra kl. 10.40 til kl. 11.10 (Det er flere som kan finne på å komme litt seint)",
      "• Eventuelt hjelpe til med praktiske oppgaver som oppstår underveis i gudstjenesten",
      "• Se over møtesalen etter brukte kaffekopper og nattverdsglass når gudstjenesten er ferdig",
    ].join("\n");
    const roles = [
      { name: "Møtevert", instruction: earlier },
      { name: "Møtevert", instruction: earlier + "\n• Låse døra til slutt" },
      { name: "Møtevert", instruction: DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Møtevert },
    ];
    const offered = rolesMissingStandardInstruction(roles);
    expect(offered.map(({ role }) => roles.indexOf(role))).toEqual([0]);
    expect(offered[0].instruction).toBe(DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Møtevert);
    expect(DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Møtevert).not.toContain("kaffekopper");
  });

  test("standarden følger menighetens eget ark, og rollen som leder en gudstjeneste, kjennes også som «Leder»", () => {
    const leader = DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Møteleder!;
    expect(leader.split("\n")).toHaveLength(17);
    expect(leader).toContain("• Legge til rette for å sitte igjen i salen når gudstjenesten er ferdig hvis du ønsker det");
    expect(DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Kjøkken).toContain("• Ta ansvar for oppvask i etterkant av kirkekaffen");
    expect(DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Barnekirke!.split("\n")).toHaveLength(9);
    expect(DEFAULT_VOLUNTEER_ROLE_INSTRUCTIONS.Lovsang!.split("\n")).toHaveLength(14);

    const offered = rolesMissingStandardInstruction([{ name: "Leder", instruction: "" }, { name: "Vaktmester", instruction: "" }]);
    expect(offered).toEqual([{ role: { name: "Leder", instruction: "" }, instruction: leader }]);
  });

  test("når ingen rolle mangler en instruks standarden har, tilbys ingenting", () => {
    render(<RolesTab studio={{ ...studio, adminVolunteerRoles: [{ id: "role-1", name: "Lyd", instruction: "Møt kl. 09:30", sortOrder: 0 }] } as unknown as StudioData} />);
    expect(screen.queryByRole("button", { name: "Legg inn standardinstrukser" })).toBeNull();
  });

  test("tilbyr standardroller når listen er tom", () => {
    render(
      <RolesTab
        studio={{
          ...studio,
          adminVolunteerRoles: [],
        }}
      />
    );
    expect(screen.getByText(/Starter med 12 roller som Baking/i)).toBeTruthy();
    expect(DEFAULT_VOLUNTEER_ROLE_NAMES.length).toBe(12);
    expect(screen.getByRole("button", { name: /Legg inn standardroller/i })).toBeTruthy();
  });

  test("åpner instruks-dialog for valgt rolle", () => {
    render(<RolesTab studio={studio} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Instruks$/i })[0]);
    expect(screen.getByText("Instruks: Lyd")).toBeTruthy();
    expect(screen.getByDisplayValue("Møt kl. 09:30")).toBeTruthy();
  });

  test("lagrer redigert instruks", async () => {
    const showFeedback = vi.fn();
    render(<RolesTab studio={studio} showFeedback={showFeedback} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Instruks$/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Møt kl. 09:30"), {
      target: { value: "Møt kl. 09:45" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lagre instruks/i }));
    await waitFor(() => expect(patchVolunteerRole).toHaveBeenCalled());
    expect(patchVolunteerRole).toHaveBeenCalledWith("role-1", {
      instruction: "Møt kl. 09:45",
      groupId: undefined,
    });
    expect(showFeedback).toHaveBeenCalledWith("«Lyd» er oppdatert.");
  });

  test("kan opprette rolle med instruks i skjemaet", async () => {
    const showFeedback = vi.fn();
    render(<RolesTab studio={studio} showFeedback={showFeedback} />);
    fireEvent.click(screen.getByRole("button", { name: /Ny rolle/i }));
    fireEvent.change(screen.getByPlaceholderText(/f.eks. Teknikk/i), { target: { value: "Vertskap" } });
    fireEvent.change(screen.getByPlaceholderText(/Instruks for rollen/i), {
      target: { value: "Stå i døra fra kl. 10:40" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lagre rolle/i }));
    await waitFor(() => expect(persistVolunteerRole).toHaveBeenCalled());
    expect(persistVolunteerRole).toHaveBeenCalledWith({
      name: "Vertskap",
      instruction: "Stå i døra fra kl. 10:40",
      sortOrder: 2,
      groupId: undefined,
    });
    expect(showFeedback).toHaveBeenCalledWith("Rollen «Vertskap» ble opprettet.");
  });
});
