import { fireEvent, screen, waitFor, within } from "@testing-library/react";

/**
 * Answers the in-page question the app asks before it deletes or sends (ConfirmProvider).
 * `text` picks the question by what it says. `yes = false` presses «Avbryt».
 */
export async function answerConfirm(text?: RegExp, yes = true): Promise<void> {
  const dialog = await waitFor(() => {
    const found = screen.getAllByRole("alertdialog").find((element) => !text || text.test(element.textContent ?? ""));
    if (!found) throw new Error(`Ingen bekreftelse med teksten ${text}`);
    return found;
  });
  const buttons = within(dialog).getAllByRole("button");
  const button = yes
    ? buttons.filter((candidate) => !["Avbryt", "Lukk"].includes(candidate.textContent?.trim() ?? "")).pop()
    : buttons.find((candidate) => candidate.textContent?.trim() === "Avbryt");
  if (!button) throw new Error("Fant ingen knapp å trykke på i bekreftelsen");
  fireEvent.click(button);
}
