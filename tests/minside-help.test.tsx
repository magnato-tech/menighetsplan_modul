// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { VolunteerHelp } from "../src/pages/myPage/VolunteerHelp";

afterEach(cleanup);

describe("Hjelp på Min side", () => {
  test("veiledningen er et «?» ved overskriften, som åpner et vindu med den samme teksten", () => {
    render(<VolunteerHelp />);
    expect(screen.queryByText(/Meld forfall/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Slik bruker du Min side" }));
    const help = screen.getByRole("dialog", { name: "Slik bruker du Min side" });
    expect(within(help).getByText(/Meld forfall/)).toBeTruthy();
    expect(within(help).getAllByRole("listitem")).toHaveLength(6);
    expect(within(help).getByText(/semesterplanen er åpnet/)).toBeTruthy();

    // Three ways out: the cross, «Lukk», and a press outside
    fireEvent.click(within(help).getByRole("button", { name: "Lukk" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Slik bruker du Min side" }));
    fireEvent.click(screen.getByRole("button", { name: "Lukk veiledningen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Slik bruker du Min side" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(document.getElementById("modal-volunteer-help")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("forklaringen vises på Min side, ikke bare i admin", () => {
    const page = readFileSync("src/pages/MyPage.tsx", "utf8");
    expect(page).toContain("<VolunteerHelp />");
    const adminHelp = readFileSync("src/pages/admin/help/articles.ts", "utf8");
    expect(adminHelp).not.toContain("Slik bruker du Min side");
  });
});
