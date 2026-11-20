// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyPageTabs, shownMyPageTabs } from "../src/pages/myPage/MyPageTabs";
import { isMinSideModuleOn, type MinSideModuleChoices } from "../src/utils/minSideModules";

afterEach(cleanup);

const tabsWith = (choices: MinSideModuleChoices) => shownMyPageTabs((id) => isMinSideModuleOn(choices, id));

describe("Fanene på Min side når en modul er av", () => {
  test("med kalender av vises ikke fanen Kalender, verken øverst eller nederst", () => {
    render(
      <MemoryRouter>
        <MyPageTabs active="oppgaver" onChange={vi.fn()} tabs={tabsWith({ kalender: false })} />
      </MemoryRouter>
    );

    const top = within(screen.getAllByRole("tablist").find((element) => element.getAttribute("aria-orientation") === "horizontal") as HTMLElement);
    expect(top.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Mine oppgaver", "Mine grupper", "Gudstjenester"]);
    const bottom = within(screen.getByRole("navigation", { name: "Min side" }));
    expect(bottom.getAllByRole("button").map((button) => button.textContent)).toEqual(["Mine oppgaver", "Mine grupper", "Gudstjenester"]);
  });

  test("med grupper av går også husfellesskap og gruppechat av, og fanen Mine grupper er borte", () => {
    const tabs = tabsWith({ grupper: false });
    expect(tabs.map((tab) => tab.id)).toEqual(["oppgaver", "kalender", "gudstjenester"]);
  });

  test("oppgavene er alltid med, og alt er med når ingenting er av", () => {
    expect(tabsWith({}).map((tab) => tab.id)).toEqual(["oppgaver", "grupper", "kalender", "gudstjenester"]);
    expect(tabsWith({ tjeneste: false, semesterplan: false }).map((tab) => tab.id)).toEqual(["oppgaver", "grupper", "kalender"]);
    expect(tabsWith({ gudstjenesteplan: false }).map((tab) => tab.id)).toEqual(["oppgaver", "grupper", "kalender"]);
  });
});
