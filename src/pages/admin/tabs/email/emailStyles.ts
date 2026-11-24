// The few pieces of styling the e-mail page shares. The rest comes from studioTheme.

/** The caption above a field. */
export const fieldLabel = "block text-[11px] font-bold text-[var(--studio-muted)] mb-1";

/** A line of help under a field. */
export const hint = "text-[11px] text-[var(--studio-muted)] mt-1";

/** The box that says how a sending or a test went. */
export const resultBox = (good: boolean): string =>
  `p-3 rounded-xl border text-xs flex items-start gap-2 ${good ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"} text-[var(--studio-text)]`;

/** A row of the left column: the view chosen, or the others. */
export const navItem = (chosen: boolean): string =>
  `flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
    chosen ? "bg-indigo-600 text-white shadow-sm" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"
  }`;
