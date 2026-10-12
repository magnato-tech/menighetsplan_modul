// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { VolunteerHelp } from "../src/pages/myPage/VolunteerHelp";

describe("Hjelp på Min side", () => {
  test("forklaringen vises på Min side, ikke bare i admin", () => {
    render(<VolunteerHelp />);
    expect(screen.getByText("Slik bruker du Min side")).toBeTruthy();
    expect(screen.getByText(/Meld forfall/)).toBeTruthy();
    const page = readFileSync("src/pages/MyPage.tsx", "utf8");
    expect(page).toContain("<VolunteerHelp />");
    const adminHelp = readFileSync("src/pages/admin/help/articles.ts", "utf8");
    expect(adminHelp).not.toContain("Slik bruker du Min side");
  });
});
