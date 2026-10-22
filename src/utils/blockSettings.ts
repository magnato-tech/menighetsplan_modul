// What every block on a page can have besides its content: when it is shown, and how it looks.
// Stored as one comment line right before the block in the page's content, so pages without
// settings are unchanged and an older reader skips the line.

export type BlockSpacing = "normal" | "liten" | "ingen";

export interface BlockSettings {
  /** First day the block is shown, YYYY-MM-DD. Empty: from now. */
  visFra?: string;
  /** Last day the block is shown, YYYY-MM-DD. Empty: no end. */
  visTil?: string;
  /** Background colour, #rrggbb. */
  bakgrunn?: string;
  /** Background picture, a URL from the picture library. */
  bakgrunnsbilde?: string;
  hvitTekst?: boolean;
  /** Space above and below the block. Normal when not set. */
  luft?: BlockSpacing;
}

export const BLOCK_SETTINGS_PREFIX = "<!-- blokk ";
const BLOCK_SETTINGS_SUFFIX = " -->";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** Keeps only values that are well formed, so a hand-edited line cannot break the page. */
export function cleanBlockSettings(input: unknown): BlockSettings {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: BlockSettings = {};
  if (typeof raw.visFra === "string" && DATE.test(raw.visFra)) out.visFra = raw.visFra;
  if (typeof raw.visTil === "string" && DATE.test(raw.visTil)) out.visTil = raw.visTil;
  if (typeof raw.bakgrunn === "string" && COLOUR.test(raw.bakgrunn)) out.bakgrunn = raw.bakgrunn.toLowerCase();
  // "--" would end the comment early
  if (typeof raw.bakgrunnsbilde === "string" && raw.bakgrunnsbilde.trim() && !raw.bakgrunnsbilde.includes("--")) {
    out.bakgrunnsbilde = raw.bakgrunnsbilde.trim();
  }
  if (raw.hvitTekst === true) out.hvitTekst = true;
  if (raw.luft === "liten" || raw.luft === "ingen") out.luft = raw.luft;
  return out;
}

export function hasBlockSettings(settings?: BlockSettings): boolean {
  return Object.keys(cleanBlockSettings(settings)).length > 0;
}

/** The comment line for the settings, or null when nothing is set (then no line is written). */
export function formatBlockSettingsLine(settings?: BlockSettings): string | null {
  const clean = cleanBlockSettings(settings);
  if (Object.keys(clean).length === 0) return null;
  return `${BLOCK_SETTINGS_PREFIX}${JSON.stringify(clean)}${BLOCK_SETTINGS_SUFFIX}`;
}

/** The settings in a comment line, or null when the line is not a settings line. */
export function parseBlockSettingsLine(line: string): BlockSettings | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(BLOCK_SETTINGS_PREFIX) || !trimmed.endsWith(BLOCK_SETTINGS_SUFFIX)) return null;
  const json = trimmed.slice(BLOCK_SETTINGS_PREFIX.length, trimmed.length - BLOCK_SETTINGS_SUFFIX.length);
  try {
    return cleanBlockSettings(JSON.parse(json));
  } catch {
    return {};
  }
}

/** Today as YYYY-MM-DD in the visitor's own time. */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type BlockPeriodState = "before" | "active" | "after";

/** Whether the block is shown on the day: both ends count as shown. */
export function blockPeriodState(settings: BlockSettings | undefined, now: Date = new Date()): BlockPeriodState {
  const today = localDay(now);
  if (settings?.visFra && today < settings.visFra) return "before";
  if (settings?.visTil && today > settings.visTil) return "after";
  return "active";
}

const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const dayMonth = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return { d, m };
};
const longDate = (date: string) => {
  const { d, m } = dayMonth(date);
  return `${d}. ${MONTHS[m - 1]}`;
};
const shortDate = (date: string) => {
  const { d, m } = dayMonth(date);
  return `${d}.${m}.`;
};

/** The period in words, e.g. "1.–31. des", "fra 1. des", "til 31. des". Null without a period. */
export function blockPeriodLabel(settings?: BlockSettings): string | null {
  const from = settings?.visFra;
  const to = settings?.visTil;
  if (from && to) {
    const a = dayMonth(from);
    const b = dayMonth(to);
    const sameMonth = a.m === b.m && from.slice(0, 4) === to.slice(0, 4);
    return sameMonth ? `${a.d}.–${longDate(to)}` : `${longDate(from)} – ${longDate(to)}`;
  }
  if (from) return `fra ${longDate(from)}`;
  if (to) return `til ${longDate(to)}`;
  return null;
}

/** The small mark in the section list: "fra 1.12.", "til 31.12." or "utløpt". Null without a period. */
export function blockPeriodBadge(settings: BlockSettings | undefined, now: Date = new Date()): string | null {
  if (!settings?.visFra && !settings?.visTil) return null;
  const state = blockPeriodState(settings, now);
  if (state === "after") return "utløpt";
  if (state === "before" && settings.visFra) return `fra ${shortDate(settings.visFra)}`;
  return settings.visTil ? `til ${shortDate(settings.visTil)}` : null;
}

/** The look in words for the folded line, e.g. "egen bakgrunnsfarge · hvit tekst". Null when nothing is set. */
export function blockLookSummary(settings?: BlockSettings): string | null {
  const parts: string[] = [];
  if (settings?.bakgrunnsbilde) parts.push("bakgrunnsbilde");
  else if (settings?.bakgrunn) parts.push("egen bakgrunnsfarge");
  if (settings?.hvitTekst) parts.push("hvit tekst");
  if (settings?.luft === "liten") parts.push("liten luft");
  if (settings?.luft === "ingen") parts.push("ingen luft");
  return parts.length > 0 ? parts.join(" · ") : null;
}
