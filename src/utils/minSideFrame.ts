// The outer card of a Min side page. One place for its classes, so every page is framed alike:
// a phone column, a wider card on a tablet and a PC (the breakpoints sm = 640px, lg = 1024px).

export type MinSideFrameWidth = "wide" | "narrow";

const BASE = "w-full mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden";

// wide: the pages with lists and several columns. narrow: a focused column, kept narrower on a tablet
const WIDTH: Record<MinSideFrameWidth, string> = {
  wide: "max-w-md sm:max-w-2xl lg:max-w-6xl",
  narrow: "max-w-md sm:max-w-xl",
};

// Room for the menu fixed at the bottom of a phone, so the last card can be scrolled clear of it
const BOTTOM_NAV_ROOM = "pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-8";

/** The classes of the outer card: the width, and room at the bottom when the page has the bottom menu. */
export function minSideFrameClass(width: MinSideFrameWidth = "wide", bottomNavRoom = false): string {
  return [BASE, WIDTH[width], bottomNavRoom ? BOTTOM_NAV_ROOM : ""].filter(Boolean).join(" ");
}

/**
 * Cards side by side as the screen grows: one column on a phone, two on a tablet, three on a PC.
 * For the lists of cards on Min side (the groups, the worship services).
 */
export const MIN_SIDE_CARD_GRID = "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 items-start";

/** One column of cards that is not stretched on a PC: it keeps the width of a tablet (Mine oppgaver). */
export const MIN_SIDE_LIST_COLUMN = "space-y-4 lg:max-w-2xl";

// The dialogs on Min side. On a phone the dialog is a sheet from the bottom; from sm (tablet) it is a
// window in the middle of the screen, and a bit wider on a PC. The dialog keeps its own background,
// padding and scrolling body; only the overlay and the panel size and place come from here.
/** The dark layer behind a dialog on Min side. */
export const MIN_SIDE_DIALOG_OVERLAY = "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4";

/** The window of a dialog on Min side: a bottom sheet on a phone, a centred window from tablet. */
export const MIN_SIDE_DIALOG_PANEL = "w-full max-w-md sm:max-w-lg lg:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden border border-slate-200";
