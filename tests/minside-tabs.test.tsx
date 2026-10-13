// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyPageTabs, MY_PAGE_TABS, toMyPageTab } from "../src/pages/myPage/MyPageTabs";
import { MyTasksTab } from "../src/pages/myPage/MyTasksTab";
import type { MyPageModel } from "../src/pages/myPage/useMyPage";

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
    render(<MyPageTabs active="oppgaver" onChange={onChange} taskCount={3} />);

    const top = screen.getByRole("tablist");
    expect(within(top).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Mine oppgaver3", "Mine grupper", "Kalender"]);
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

  test("uten oppgaver står det ikke noe tall på fanen", () => {
    render(<MyPageTabs active="grupper" onChange={() => undefined} taskCount={0} />);
    expect(screen.getAllByText("Mine oppgaver")[0].parentElement?.textContent).toBe("Mine oppgaver");
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

  test("Min side har fanene under det som trenger handling, og ingen egen bunnmeny eller oppgaveliste i et vindu", () => {
    const page = readFileSync("src/pages/MyPage.tsx", "utf8");
    expect(page.indexOf("<AttentionSection")).toBeGreaterThan(0);
    expect(page.indexOf("<MyPageTabs")).toBeGreaterThan(page.indexOf("<AttentionSection"));
    expect(page).toContain("<MyCalendarPanel inline />");
    expect(page).not.toContain("MobileBottomNav");
    expect(page).not.toContain("MyTasksModal");
    expect(page).not.toContain("Vis oppgaveliste");
  });
});
