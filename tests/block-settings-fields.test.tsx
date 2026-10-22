// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BlockSettingsFields } from "../src/pages/admin/tabs/pages/BlockSettingsFields";
import { PageSectionNav, type PageSection } from "../src/components/admin/PageSectionNav";

afterEach(cleanup);

const renderFields = (value?: Parameters<typeof BlockSettingsFields>[0]["value"]) => {
  const onChange = vi.fn();
  render(<BlockSettingsFields value={value} onChange={onChange} />);
  return onChange;
};

const open = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("BlockSettingsFields", () => {
  test("lukkede deler viser standard og alltid når ingenting er satt", () => {
    renderFields({});
    expect(screen.getByRole("button", { name: /Utseende/ }).textContent).toContain(": standard");
    expect(screen.getByRole("button", { name: /Når den vises/ }).textContent).toContain(": alltid");
    expect(screen.getByRole("button", { name: /Utseende/ }).getAttribute("aria-expanded")).toBe("false");
  });

  test("valg av Farge og ny farge lagrer bakgrunn", () => {
    const onChange = renderFields({});
    open(/Utseende/);
    fireEvent.click(screen.getByRole("button", { name: "Farge" }));
    fireEvent.change(screen.getByLabelText("Bakgrunnsfarge"), { target: { value: "#336699" } });
    expect(onChange).toHaveBeenCalledWith({ bakgrunn: "#336699" });
  });

  test("Hvit tekst legger til hvitTekst", () => {
    const onChange = renderFields({});
    open(/Utseende/);
    fireEvent.click(screen.getByRole("checkbox", { name: "Hvit tekst" }));
    expect(onChange).toHaveBeenCalledWith({ hvitTekst: true });
  });

  test("Vis til lagrer visTil", () => {
    const onChange = renderFields({});
    open(/Når den vises/);
    fireEvent.change(screen.getByLabelText("Vis til"), { target: { value: "2030-12-31" } });
    expect(onChange).toHaveBeenCalledWith({ visTil: "2030-12-31" });
  });

  test("Vis til før Vis fra viser melding og lagrer ikke", () => {
    const onChange = renderFields({ visFra: "2030-06-01" });
    open(/Når den vises/);
    fireEvent.change(screen.getByLabelText("Vis til"), { target: { value: "2030-05-01" } });
    expect(screen.getByText("Til-datoen er før fra-datoen.")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("med tidsrom etter i dag: lukket overskrift viser til-dato, åpen viser at perioden er over", () => {
    renderFields({ visTil: "2000-01-01" });
    expect(screen.getByRole("button", { name: /Når den vises/ }).textContent).toContain(": til 1. jan");
    open(/Når den vises/);
    expect(screen.getByText(/Perioden er over/)).toBeTruthy();
  });
});

describe("PageSectionNav badge", () => {
  test("viser merket etter etiketten", () => {
    const sections: PageSection[] = [
      { id: "b1", kind: "block", label: "Julefest", badge: "til 31.12." },
    ];
    render(
      <PageSectionNav
        sections={sections}
        activeId={null}
        onSelect={vi.fn()}
        onReorderBlocks={vi.fn()}
        onToggleHidden={vi.fn()}
        onCollapse={vi.fn()}
      />
    );
    expect(screen.getByTitle("til 31.12.").textContent).toBe("til 31.12.");
  });
});
