/**
 * Min side on PC (lg and up): the tabs of the group room and the house group are replaced by
 * columns side by side. On mobile and tablet the tabs stay. Used only on the page, not in a popup.
 *
 * Tailwind's preflight makes the `hidden` attribute display:none !important, so visibility is
 * set with classes: a section that is not the active tab is hidden below lg and shown on lg.
 */
export const PC_COLUMNS = "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:items-start";

/** Class for a section in the columns: none when it is the active tab, hidden below lg otherwise. */
export const pcTab = (active: boolean): string => (active ? "" : "hidden lg:block");

/** The white card a column section gets on PC only. */
export const PC_CARD = "lg:bg-white lg:rounded-2xl lg:border lg:border-slate-200/80 lg:p-4 lg:shadow-2xs";

/** Heading of a column section, shown on PC only (the tabs that name it are hidden there). */
export const PC_HEADING = "hidden lg:block text-sm font-bold text-slate-800";
