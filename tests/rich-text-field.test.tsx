// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ pages: [] }) }));

import RichTextField from "../src/components/admin/RichTextField";

// Backlog 5: a block's text is shown formatted with buttons, and as plain text when it has signs the
// field has no button for.

afterEach(cleanup);

describe("Tekstfeltet med knapper", () => {
  test("en tekstblokk vises formatert, med knappene for overskrift og lister", async () => {
    const { container } = render(<RichTextField mode="full" label="Tekst" value={"## Velkommen\nVi møtes **søndag**.\n- Kaffe"} onChange={vi.fn()} />);
    await waitFor(() => expect(container.querySelector("h2")?.textContent).toBe("Velkommen"));
    expect(container.querySelector("strong")?.textContent).toBe("søndag");
    expect(container.querySelector("ul li")?.textContent).toBe("Kaffe");
    for (const name of ["Overskrift", "Underoverskrift", "Fet", "Kursiv", "Punktliste", "Nummerert liste", "Lenke"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  test("i et kort er det bare fet, kursiv og lenke", () => {
    render(<RichTextField mode="inline" label="Tekst" value="hei" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Overskrift" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Punktliste" })).toBeNull();
    expect(screen.getByRole("button", { name: "Fet" })).toBeTruthy();
  });

  test("tegn uten knapp gir vanlig tekst, og ingenting blir borte", () => {
    const onChange = vi.fn();
    render(<RichTextField mode="full" label="Tekst" value={"> et sitat"} onChange={onChange} />);
    const textarea = screen.getByRole("textbox", { name: "Tekst" }) as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.value).toBe("> et sitat");
    expect(screen.getByText(/ingenting blir borte/i)).toBeTruthy();
    fireEvent.change(textarea, { target: { value: "> et annet sitat" } });
    expect(onChange).toHaveBeenCalledWith("> et annet sitat");
  });

  test("Vis som tekst viser tegnene, og Vis formatert går tilbake", () => {
    render(<RichTextField mode="full" label="Tekst" value={"## Hei"} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Vis som tekst"));
    expect((screen.getByRole("textbox", { name: "Tekst" }) as HTMLTextAreaElement).value).toBe("## Hei");
    fireEvent.click(screen.getByText("Vis formatert"));
    expect(screen.getByRole("button", { name: "Overskrift" })).toBeTruthy();
  });
});
