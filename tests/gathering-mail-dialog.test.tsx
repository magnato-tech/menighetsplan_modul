// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Assignment, Gathering, Person, Task } from "../src/types";
import type { EmailRecord } from "../src/utils/emailOutcome";

// The e-mail to everyone on a gathering: who is counted, what is missing an address, and the one sending to
// the people on it as their own audience (not a newsletter).

const mocks = vi.hoisted(() => ({
  record: { replyTo: "post@example.org", log: [] } as EmailRecord,
  requestEmail: vi.fn(async () => ({ ok: true as const, mode: "send" as const, sent: 2, withoutEmail: 1, stopped: null, remainingPersonIds: [] })),
  saveEmailLog: vi.fn(async () => undefined),
}));

vi.mock("../src/demo", () => ({ DEMO: null }));
vi.mock("../src/services/email", () => ({
  requestEmail: mocks.requestEmail,
  saveEmailLog: mocks.saveEmailLog,
  subscribeEmailRecord: (onChange: (record: EmailRecord) => void) => {
    onChange(mocks.record);
    return () => undefined;
  },
}));

import { GatheringMailDialog } from "../src/components/gathering/GatheringMailDialog";

const gathering = { id: "g1", groupId: "menighet", title: "Gudstjeneste", startsAt: "2026-11-08T10:00:00+01:00" } as Gathering;
const tasks = [{ id: "t1", gatheringId: "g1", title: "Lyd" } as Task];
const persons = [
  { id: "astri", name: "Astri Berg", email: "astri@example.org" },
  { id: "preben", name: "Preben Dahl" },
  { id: "kari", name: "Kari Nordmann", email: "kari@example.org" },
] as Person[];
const assignments: Assignment[] = [
  { id: "a1", taskId: "t1", personId: "astri", response: "confirmed" },
  { id: "a2", taskId: "t1", personId: "preben", response: "pending" },
  { id: "a3", taskId: "t1", personId: "kari", response: "declined" },
];

const show = (onSent = vi.fn()) =>
  render(
    <MemoryRouter>
      <GatheringMailDialog gathering={gathering} tasks={tasks} assignments={assignments} persons={persons} onSent={onSent} onClose={() => undefined} />
    </MemoryRouter>
  );

beforeEach(() => {
  mocks.record = { replyTo: "post@example.org", log: [] };
  mocks.requestEmail.mockClear();
  mocks.saveEmailLog.mockClear();
  vi.stubGlobal("confirm", () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("E-post til alle som er med", () => {
  test("teller de bekreftede og spurte, én gang hver, og nevner dem uten e-post", () => {
    show();
    expect(screen.getByText("2 personer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vis navnene" }));
    const list = document.getElementById("gathering-mail-people");
    expect(list?.textContent).toContain("Astri Berg");
    expect(list?.textContent).toContain("Preben Dahl (uten e-post)");
    expect(list?.textContent).not.toContain("Kari Nordmann");
  });

  test("emnet er tittelen og datoen, og teksten er tom", () => {
    show();
    expect((screen.getByRole("textbox", { name: "Emne" }) as HTMLInputElement).value).toBe("Gudstjeneste søndag 8. november");
    expect((screen.getByRole("textbox", { name: "Tekst" }) as HTMLTextAreaElement).value).toBe("");
  });

  test("sendes til de på arrangementet som sin egen mottakerliste, ikke som nyhetsbrev", async () => {
    const onSent = vi.fn();
    show(onSent);
    fireEvent.change(screen.getByRole("textbox", { name: "Tekst" }), { target: { value: "Vi ses kl. 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalledWith(2));
    expect(mocks.requestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "send", audience: { kind: "persons" }, onlyPersonIds: ["astri", "preben"], text: "Vi ses kl. 10" })
    );
    expect(mocks.saveEmailLog).toHaveBeenCalledTimes(1);
  });

  test("uten lagret svaradresse sier dialogen det i én linje, med lenke til Send e-post", () => {
    mocks.record = { replyTo: "", log: [] };
    show();
    const link = screen.getByRole("link", { name: "Send e-post" });
    expect(link.getAttribute("href")).toBe("/admin?tab=epost");
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
