// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { EmailTab } from "../src/pages/admin/tabs/EmailTab";
import type { Group, Person } from "../src/types";
import type { EmailOutcome, EmailRecord } from "../src/utils/emailOutcome";
import { EPOST_HANDOVER_KEY, LISTS_NOT_PUBLISHED, type EmailList } from "../src/utils/emailLists";

// «Send e-post» with lists of persons: the handover from Personer, the view «Lister», and what the lists
// reach. Everyone here is made up.

const service = vi.hoisted(() => ({
  record: { replyTo: "post@example.org", log: [] } as EmailRecord,
  requestEmail: vi.fn(),
  saveEmailLog: vi.fn(async (_log: unknown[]) => undefined),
  saveReplyTo: vi.fn(async () => undefined),
}));
vi.mock("../src/services/email", () => ({
  requestEmail: service.requestEmail,
  saveEmailLog: service.saveEmailLog,
  saveReplyTo: service.saveReplyTo,
  subscribeEmailRecord: (onChange: (record: EmailRecord) => void) => {
    onChange(service.record);
    return () => undefined;
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Fjellbygda menighet" } }) }));

const lists = vi.hoisted(() => ({
  items: [] as unknown[],
  denied: false,
  save: vi.fn(async (_list: unknown) => undefined),
  rename: vi.fn(async (_id: string, _name: string) => undefined),
  remove: vi.fn(async (_id: string) => undefined),
  setPersons: vi.fn(async (_id: string, _personIds: string[]) => undefined),
}));
vi.mock("../src/services/emailLists", () => ({
  subscribeEmailLists: (onChange: (items: unknown[]) => void, onError: (error: unknown) => void) => {
    if (lists.denied) onError({ code: "permission-denied" });
    else onChange(lists.items);
    return () => undefined;
  },
  saveEmailList: lists.save,
  renameEmailList: lists.rename,
  setListPersons: lists.setPersons,
  deleteEmailList: lists.remove,
}));

// The semester plans and the newsletter are not in this test
vi.mock("../src/services/semesterPlans", () => ({
  subscribeSemesterPlans: (onChange: (plans: unknown[]) => void) => {
    onChange([]);
    return () => undefined;
  },
  subscribeMySemesterAnswers: () => () => undefined,
  subscribeAllSemesterAnswers: () => () => undefined,
  saveSemesterPlan: vi.fn(async () => true),
  deleteSemesterPlan: vi.fn(async () => true),
  saveAnswerStep: vi.fn(async () => true),
  restartAnswer: vi.fn(async () => true),
}));
vi.mock("../src/services/newsletter", () => ({
  subscribeNewsletterOptOuts: (onChange: (keys: string[]) => void) => {
    onChange([]);
    return () => undefined;
  },
  subscribeNewsletterBanner: (onChange: (banner: string | null) => void) => {
    onChange(null);
    return () => undefined;
  },
  optBackIn: vi.fn(),
}));

const person = (id: string, name: string, email?: string): Person => ({ id, name, email, globalRole: "member" });
const group = (id: string, name: string, category: Group["category"], leaderIds: string[], memberIds: string[]): Group => ({ id, name, category, leaderIds, memberIds });

const persons: Person[] = [person("hanne", "Hanne Husleder", "hanne@example.org"), person("lars", "Lars Leder", "lars@example.org"), person("nora", "Nora Nestleder", "nora@example.org"), person("frida", "Frida Frivillig", "frida@example.org")];
const groups: Group[] = [group("hus", "Husgruppe øst", "husgruppe", ["hanne"], ["hanne", "frida"]), group("lyd", "Lyd og bilde", "tjenestegruppe", ["lars"], ["lars", "nora", "frida"])];

const meta = { createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z", createdBy: "kari" };
const husgrupper: EmailList = { id: "liste-1", name: "Husgrupper", kind: "filter", filter: { roles: ["leader"], categories: ["husgruppe"] }, ...meta };
const styret: EmailList = { id: "liste-2", name: "Styret", kind: "fixed", personIds: ["lars", "nora"], ...meta };

const studio = {
  adminPersons: persons.map((one) => ({ person: one, groups: groups.filter((g) => g.memberIds.includes(one.id) || g.leaderIds.includes(one.id)), leaderInGroups: [], deputyInGroups: [] })),
  adminGroups: groups.map((one) => ({ group: one })),
  currentUser: person("kari", "Kari Nordmann"),
} as unknown as Parameters<typeof EmailTab>[0]["studio"];

const showFeedback = vi.fn();
const Where = () => <span data-testid="adresse">{useLocation().search}</span>;
const show = (vis?: string) =>
  render(
    <MemoryRouter initialEntries={[`/admin?tab=epost${vis ? `&vis=${vis}` : ""}`]}>
      <EmailTab studio={studio} showFeedback={showFeedback} canSend now={() => new Date("2026-10-14T12:00:00.000Z")} />
      <Where />
    </MemoryRouter>
  );
/** The question in the page, once it is shown: its text. */
const askedText = async (): Promise<string | null> => {
  const box = await screen.findByRole("alertdialog");
  return document.getElementById(box.getAttribute("aria-labelledby") ?? "")?.textContent ?? null;
};
/** Answers the question in the page with the button of that name, once it is shown. */
const answer = async (name: "Send" | "Avbryt" | "Slett") => {
  const box = await screen.findByRole("alertdialog");
  fireEvent.click(within(box).getByRole("button", { name }));
};
/** The row of a list in «Lister». */
const rowOf = (name: string) => screen.getByText(name, { selector: "p" }).closest("li") as HTMLElement;

beforeEach(() => {
  window.sessionStorage.clear();
  service.record = { replyTo: "post@example.org", log: [] };
  service.requestEmail.mockReset();
  service.requestEmail.mockResolvedValue({ ok: true, mode: "send", sent: 2, withoutEmail: 0, stopped: null, remainingPersonIds: [] } as EmailOutcome);
  lists.items = [husgrupper, styret];
  lists.denied = false;
  lists.rename.mockClear();
  lists.remove.mockClear();
  lists.setPersons.mockClear();
  showFeedback.mockClear();
  vi.stubGlobal("confirm", vi.fn(() => true));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Utvalget fra Personer i «Til»", () => {
  test("utvalget kommer som én brikke, og sendes til de personene", async () => {
    window.sessionStorage.setItem(EPOST_HANDOVER_KEY, JSON.stringify({ personIds: ["hanne", "frida"], label: "Utvalg: Leder · Husgruppe" }));
    show();
    expect(screen.getByRole("button", { name: "Fjern Utvalg: Leder · Husgruppe" })).toBeTruthy();
    expect(window.sessionStorage.getItem(EPOST_HANDOVER_KEY)).toBeNull();
    // The selection replaces the default audience, so only the selection is sent to
    expect(screen.queryByRole("button", { name: "Fjern Ledere og nestledere i tjenestegruppene" })).toBeNull();
    expect(document.getElementById("email-recipient-count")?.textContent).toBe("2 personer");
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    await answer("Send");
    await vi.waitFor(() => expect(service.requestEmail).toHaveBeenCalledTimes(1));
    expect(service.requestEmail).toHaveBeenCalledWith(expect.objectContaining({ mode: "send", audience: { kind: "persons" }, onlyPersonIds: ["hanne", "frida"] }));
  });
});

describe("Lister i «Send e-post»", () => {
  test("listene vises med hva de er, hvor mange de er, og de som står på dem", () => {
    show("lister");
    expect(screen.getByRole("region", { name: "Lister" })).toBeTruthy();
    expect(screen.getByText("Oppdateres av seg selv · Leder · Husgruppe · 1 person")).toBeTruthy();
    expect(screen.getByText("Fast utvalg · 2 personer")).toBeTruthy();
    expect(screen.queryByText("Lars Leder")).toBeNull();
    fireEvent.click(within(rowOf("Styret")).getByRole("button", { name: "Vis personer" }));
    expect(within(rowOf("Styret")).getByText("Lars Leder")).toBeTruthy();
    expect(within(rowOf("Styret")).getByText("Nora Nestleder")).toBeTruthy();
  });

  test("«Send e-post til listen» går til Ny e-post, med listen som eneste brikke", () => {
    show("lister");
    fireEvent.click(within(rowOf("Styret")).getByRole("button", { name: "Send e-post til listen" }));
    expect(screen.getByRole("button", { name: "Fjern Styret" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fjern Ledere og nestledere i tjenestegruppene" })).toBeNull();
    expect(document.getElementById("email-recipient-count")?.textContent).toBe("2 personer");
    expect(screen.getByTestId("adresse").textContent).toBe("?tab=epost");
  });

  test("en liste kan få nytt navn, og slettes når det er bekreftet", async () => {
    show("lister");
    fireEvent.click(within(rowOf("Husgrupper")).getByRole("button", { name: "Gi nytt navn" }));
    fireEvent.change(screen.getByLabelText("Nytt navn på Husgrupper"), { target: { value: "Husgruppeledere" } });
    fireEvent.click(within(rowOf("Husgrupper")).getByRole("button", { name: "Lagre navn" }));
    await vi.waitFor(() => expect(lists.rename).toHaveBeenCalledWith("liste-1", "Husgruppeledere"));

    fireEvent.click(within(rowOf("Styret")).getByRole("button", { name: "Slett" }));
    expect(await askedText()).toBe("Slette listen «Styret»? Personene slettes ikke, bare listen.");
    await answer("Slett");
    await vi.waitFor(() => expect(lists.remove).toHaveBeenCalledWith("liste-2"));
  });

  test("ingen sletting uten bekreftelse, og siden spør aldri med window.confirm", async () => {
    show("lister");
    fireEvent.click(within(rowOf("Styret")).getByRole("button", { name: "Slett" }));
    await answer("Avbryt");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(lists.remove).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  test("en fast liste får en person lagt til, og en tatt av", async () => {
    show("lister");
    fireEvent.click(within(rowOf("Styret")).getByRole("button", { name: "Legg til person" }));
    fireEvent.change(screen.getByLabelText("Finn person til Styret"), { target: { value: "frida" } });
    fireEvent.click(screen.getByRole("button", { name: "Legg til Frida Frivillig" }));
    await vi.waitFor(() => expect(lists.setPersons).toHaveBeenCalledWith("liste-2", ["lars", "nora", "frida"]));

    fireEvent.click(within(rowOf("Styret")).getByRole("button", { name: "Vis personer" }));
    fireEvent.click(screen.getByRole("button", { name: "Fjern Lars Leder fra listen" }));
    await vi.waitFor(() => expect(lists.setPersons).toHaveBeenLastCalledWith("liste-2", ["nora"]));
  });

  test("uten lov til å lagre lister står den rolige meldingen, og resten av siden virker", () => {
    lists.denied = true;
    show("lister");
    expect(screen.getByText(LISTS_NOT_PUBLISHED)).toBeTruthy();
    expect(screen.queryByText("Styret")).toBeNull();
    // The e-mail itself still works
    fireEvent.click(screen.getByRole("button", { name: "Ny e-post" }));
    expect(screen.getByRole("button", { name: /^Send til/ })).toBeTruthy();
  });
});
