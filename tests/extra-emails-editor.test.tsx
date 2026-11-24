// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExtraEmailsEditor } from "../src/components/admin/ExtraEmailsEditor";
import type { ExtraEmail } from "../src/types";

// The rows of extra addresses in the person form. The addresses are made up.

function Form({ start, onRows }: { start: ExtraEmail[]; onRows: (rows: ExtraEmail[]) => void }) {
  const [rows, setRows] = useState(start);
  return (
    <ExtraEmailsEditor
      rows={rows}
      onChange={(next) => {
        setRows(next);
        onRows(next);
      }}
    />
  );
}

describe("Andre e-postadresser i personskjemaet", () => {
  afterEach(() => cleanup());

  test("en ny adresse får ingen kopi og kan logge inn, og en rad kan fjernes", () => {
    const onRows = vi.fn();
    render(<Form start={[{ address: "ola@eksempel.no", copy: false, login: true }]} onRows={onRows} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Legg til adresse" }));
    expect(onRows).toHaveBeenLastCalledWith([
      { address: "ola@eksempel.no", copy: false, login: true },
      { address: "", copy: false, login: true },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Fjern ola@eksempel.no" }));
    expect(onRows).toHaveBeenLastCalledWith([{ address: "", copy: false, login: true }]);
  });

  test("de to valgene kan krysses av hver for seg", () => {
    const onRows = vi.fn();
    render(<Form start={[{ address: "ola@eksempel.no", copy: false, login: true }]} onRows={onRows} />);

    fireEvent.click(screen.getByLabelText("Få kopi"));
    expect(onRows).toHaveBeenLastCalledWith([{ address: "ola@eksempel.no", copy: true, login: true }]);

    fireEvent.click(screen.getByLabelText("Logge inn"));
    expect(onRows).toHaveBeenLastCalledWith([{ address: "ola@eksempel.no", copy: true, login: false }]);
  });

  test("adressen kan skrives, og står med hjelpeteksten om hva valgene betyr", () => {
    const onRows = vi.fn();
    render(<Form start={[{ address: "", copy: false, login: true }]} onRows={onRows} />);

    fireEvent.change(screen.getByLabelText("Andre e-postadresse"), { target: { value: "per@eksempel.no" } });
    expect(onRows).toHaveBeenLastCalledWith([{ address: "per@eksempel.no", copy: false, login: true }]);
    expect(screen.getByText(/En adresse som står på to personer, kan ingen av dem logge inn med\./)).toBeTruthy();
  });
});
