// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "../src/components/ConfirmProvider";

function Ask({ text, options, onAnswer }: { text: string; options?: ConfirmOptions; onAnswer: (answer: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => void confirm(text, options).then(onAnswer)}>
      Spør
    </button>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConfirmProvider: egen bekreftelse på siden", () => {
  test("«OK» gir ja, og spørsmålet står i en alertdialog med teksten som navn", async () => {
    const onAnswer = vi.fn();
    render(
      <ConfirmProvider>
        <Ask text="Er du sikker?" onAnswer={onAnswer} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    const dialog = screen.getByRole("alertdialog", { name: "Er du sikker?" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("«Avbryt» og Escape gir nei", async () => {
    const onAnswer = vi.fn();
    render(
      <ConfirmProvider>
        <Ask text="Slette?" onAnswer={onAnswer} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(false));

    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("ja-knappen har fått fokus, og en farlig handling har rød ja-knapp med eget ord", () => {
    render(
      <ConfirmProvider>
        <Ask text="Slette?" options={{ yes: "Slett", danger: true }} onAnswer={() => undefined} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    const yes = screen.getByRole("button", { name: "Slett" });
    expect(document.activeElement).toBe(yes);
    expect(yes.className).toContain("bg-red-700");
  });

  test("uten fare er ja-knappen ikke rød", () => {
    render(
      <ConfirmProvider>
        <Ask text="Sende?" options={{ yes: "Send" }} onAnswer={() => undefined} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    expect(screen.getByRole("button", { name: "Send" }).className).not.toContain("bg-red-700");
  });

  test("et linjeskift i teksten gir nye avsnitt", () => {
    render(
      <ConfirmProvider>
        <Ask text={"Første linje?\nAndre linje."} onAnswer={() => undefined} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    expect(screen.getByText("Første linje?").tagName).toBe("P");
    expect(screen.getByText("Andre linje.").tagName).toBe("P");
  });

  test("uten ConfirmProvider spør den window.confirm, så ingenting går i stå", async () => {
    const confirmStub = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmStub);
    const onAnswer = vi.fn();
    render(<Ask text="Gammel spørring?" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "Spør" }));
    expect(confirmStub).toHaveBeenCalledWith("Gammel spørring?");
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
  });
});
