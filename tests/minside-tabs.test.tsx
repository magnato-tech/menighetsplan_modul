// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyPageTabs, MY_PAGE_TABS, toMyPageTab } from "../src/pages/myPage/MyPageTabs";
import { MyTasksTab } from "../src/pages/myPage/MyTasksTab";
import type { MyPageModel } from "../src/pages/myPage/useMyPage";
import { AttentionSection } from "../src/pages/myPage/AttentionSection";
import { AccountMenu, initialsOf } from "../src/components/AccountMenu";
import { repeatsTitle } from "../src/utils/labels";

const account = vi.hoisted(() => ({
  session: { status: "member", person: { id: "kari", name: "Kari Nordmann", globalRole: "member" } },
  groups: [],
  signOut: vi.fn(async () => undefined),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => account }));

afterEach(cleanup);

describe("Fanene på Min side", () => {
  test("det er tre faner, og siden åpner i oppgavene når adressen ikke ber om noe annet", () => {
    expect(MY_PAGE_TABS.map((tab) => tab.label)).toEqual(["Mine oppgaver", "Mine grupper", "Kalender"]);
    expect(toMyPageTab(null)).toBe("oppgaver");
    expect(toMyPageTab("tull")).toBe("oppgaver");
    expect(toMyPageTab("grupper")).toBe("grupper");
    expect(toMyPageTab("kalender")).toBe("kalender");
  });

  test("fanene står både øverst og nederst, og et trykk bytter fane", () => {
    const onChange = vi.fn();
    render(<MyPageTabs active="oppgaver" onChange={onChange} />);

    const top = screen.getByRole("tablist");
    // No number on a tab: the tasks are counted where they are listed
    expect(within(top).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Mine oppgaver", "Mine grupper", "Kalender"]);
    expect(within(top).getByRole("tab", { selected: true }).textContent).toContain("Mine oppgaver");

    const bottom = screen.getByRole("navigation", { name: "Min side" });
    const buttons = within(bottom).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute("aria-current")).toBe("page");
    // The bottom bar is for the phone only, the top one for wider screens
    expect(bottom.className).toContain("sm:hidden");
    expect(top.className).toContain("hidden sm:flex");

    fireEvent.click(within(bottom).getByText("Kalender"));
    expect(onChange).toHaveBeenCalledWith("kalender");
    fireEvent.click(within(top).getByText("Mine grupper"));
    expect(onChange).toHaveBeenCalledWith("grupper");
  });

  test("heller ikke menylinjen nederst har noe tall", () => {
    render(<MyPageTabs active="grupper" onChange={() => undefined} />);
    const bottom = screen.getByRole("navigation", { name: "Min side" });
    expect(within(bottom).getAllByRole("button").map((button) => button.textContent)).toEqual(["Mine oppgaver", "Mine grupper", "Kalender"]);
  });

  test("oppgavene står rett på siden, med arrangement og tidspunkt, og fører til oppgaven", () => {
    const gatherings = [
      { id: "g1", title: "Gudstjeneste", startsAt: "2027-01-10T11:00:00" },
      { id: "g2", title: "Menighetsfest", startsAt: "2027-01-24T16:00:00" },
    ];
    const page = {
      myTasks: [
        { id: "t1", title: "Møtevert", gatheringId: "g1", description: "Ta imot i døra" },
        { id: "t2", title: "Kjøkken", gatheringId: "g2" },
      ],
      getGatheringById: (id: string) => gatherings.find((gathering) => gathering.id === id),
    } as unknown as MyPageModel;

    render(
      <MemoryRouter>
        <MyTasksTab page={page} />
      </MemoryRouter>
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/oppgave/t1", "/oppgave/t2"]);
    expect(links[0].textContent).toContain("Møtevert");
    expect(links[0].textContent).toContain("Gudstjeneste");
    expect(links[0].textContent).toContain("Ta imot i døra");
    expect(links[1].textContent).toContain("Menighetsfest");
  });

  test("den som ikke har noen oppgaver, får vite det", () => {
    const page = { myTasks: [], getGatheringById: () => undefined } as unknown as MyPageModel;
    render(
      <MemoryRouter>
        <MyTasksTab page={page} />
      </MemoryRouter>
    );
    expect(screen.getByText("Du har ingen oppgaver framover")).toBeTruthy();
  });

  test("Min side er forenklet: overskriften er fanens navn, og handlingsboksen står bare på oppgavene", () => {
    const page = readFileSync("src/pages/MyPage.tsx", "utf8");
    // The heading is the name of the open tab, never «Min side» on all three
    expect(page).toContain("{heading}");
    expect(page).not.toMatch(/<span>Min side<\/span>|Oversikt for|grupper"\}/);
    // The action box and the note about service groups are inside the tasks tab
    const tasks = page.slice(page.indexOf('{tab === "oppgaver" && ('), page.indexOf('{tab === "grupper"'));
    expect(tasks).toContain("<AttentionSection");
    expect(tasks).toContain("<MyTasksTab");
    expect(page.split("<AttentionSection").length).toBe(2);
    // The calendar is the first and only thing on its tab
    expect(page).toContain('{tab === "kalender" && <MyCalendarPanel />}');
    expect(page).not.toMatch(/NextChurchEventSection|NextForYouSection|MobileBottomNav|MyTasksModal|Vis oppgaveliste/);
    // Room for the last card above the menu at the bottom of a phone
    expect(page).toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))]");
  });
});

describe("Det som er tatt bort fra Min side", () => {
  const attention = (count: number) =>
    ({
      attentionItems: Array.from({ length: count }, (_, index) => ({ id: `a${index}`, type: "open_task", title: "Gudstjeneste", groupName: index === 0 ? "Gudstjeneste & Storsamling" : "Lyd og bilde", startsAt: "2027-01-10T11:00:00" })),
      handleAttentionAnswer: vi.fn(),
    }) as unknown as MyPageModel;

  test("mange ledige oppgaver er én knapp med antallet i parentes", () => {
    const onShowAll = vi.fn();
    render(<AttentionSection page={attention(68)} onShowAll={onShowAll} />);
    const box = document.getElementById("section-trenger-oppmerksomhet")!;
    expect(box.textContent).toBe("Se ledige oppgaver (68)");
    fireEvent.click(screen.getByRole("button", { name: "Se ledige oppgaver (68)" }));
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  test("en forespørsel til deg står synlig over knappen, også når det er mange ledige oppgaver", () => {
    const page = attention(5);
    page.attentionItems.unshift({ id: "r1", type: "task_request", assignmentId: "as1", title: "Gudstjeneste 1. november", role: "Møteleder", startsAt: "2027-01-10T11:00:00" } as never);
    render(<AttentionSection page={page} onShowAll={() => undefined} />);
    expect(screen.getByText("Forespørsel til deg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ja, jeg kan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Se ledige oppgaver (5)" })).toBeTruthy();
  });

  test("med én eller to saker står kortene rett på siden, uten overskrift, og gruppa nevnes bare når tittelen ikke sier det samme", () => {
    render(<AttentionSection page={attention(2)} onShowAll={() => undefined} />);
    const box = document.getElementById("section-trenger-oppmerksomhet")!;
    expect(box.textContent).not.toMatch(/Trenger din oppmerksomhet|saker|Dette trenger din handling/);
    expect(screen.queryByText("Gudstjeneste & Storsamling")).toBeNull();
    expect(screen.getByText("Lyd og bilde")).toBeTruthy();
  });

  test("en merkelapp som bare gjentar tittelen, sier ingenting", () => {
    expect(repeatsTitle("Gudstjeneste & Storsamling", "Gudstjeneste")).toBe(true);
    expect(repeatsTitle("Gudstjeneste", "Gudstjeneste & dåp")).toBe(true);
    expect(repeatsTitle("gudstjeneste", "GUDSTJENESTE")).toBe(true);
    expect(repeatsTitle("", "Gudstjeneste")).toBe(true);
    expect(repeatsTitle("Menigheten", "Gudstjeneste")).toBe(false);
    expect(repeatsTitle("Lyd og bilde", "Gudstjeneste")).toBe(false);
    // Part of a word is not the same word
    expect(repeatsTitle("Ung", "Ungdomskveld")).toBe(false);
  });

  test("kalenderen har ingen egen ramme med overskrift, og gruppene ingen overskrift som gjentar fanen", () => {
    const calendar = readFileSync("src/pages/myPage/MyCalendarPanel.tsx", "utf8");
    expect(calendar).not.toMatch(/>Min kalender<|Lukk kalender|modal-my-calendar/);
    expect(calendar).toContain("repeatsTitle(label, event.gathering.title)");
    expect(readFileSync("src/pages/myPage/MyGroupsSection.tsx", "utf8")).not.toMatch(/Mine grupper \(|Deltakelse/);
  });

  test("navn, rolle og «Logg ut» ligger bak et rundt merke med initialene", () => {
    expect(initialsOf("Magnar Totland")).toBe("MT");
    expect(initialsOf("  kari  anne   nordmann ")).toBe("KN");
    expect(initialsOf("Ola")).toBe("O");
    expect(initialsOf("")).toBe("?");

    render(<AccountMenu />);
    const mark = screen.getByRole("button", { name: "Konto: Kari Nordmann" });
    expect(mark.textContent).toBe("KN");
    expect(screen.queryByText("Kari Nordmann")).toBeNull();
    expect(screen.queryByText("Logg ut")).toBeNull();

    fireEvent.click(mark);
    const menu = screen.getByRole("menu", { name: "Konto" });
    expect(within(menu).getByText("Kari Nordmann")).toBeTruthy();
    expect(within(menu).getByText("Frivillig")).toBeTruthy();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Logg ut" }));
    expect(account.signOut).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
