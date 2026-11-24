// Where the run sheet goes back to. It is opened from the calendar on Min side, or from the
// Gudstjenester tab (?fra=gudstjenester), and the back link goes to the one it came from.

const BACK_TO_CALENDAR = "/minside?view=kalender";
const BACK_TO_WORSHIP = "/minside?view=gudstjenester";

/** The back link of the run sheet, from the query of the address it was opened at. */
export function runSheetBackLink(search: string): string {
  return new URLSearchParams(search).get("fra") === "gudstjenester" ? BACK_TO_WORSHIP : BACK_TO_CALENDAR;
}

/** The text of the link back, so that it names the place the link goes to. */
export function runSheetBackLabel(search: string): string {
  return runSheetBackLink(search) === BACK_TO_WORSHIP ? "Tilbake til gudstjenestene" : "Tilbake til kalenderen";
}
