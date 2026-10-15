// What the buttons over the text on «Send e-post» do to the text: they write the marks that
// utils/emailMessage.ts reads (## heading, - point, **bold**, [text](address)). Each takes the text
// and what is selected in it, and gives back the new text and what is to be selected after.

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

/** The whole lines the selection touches. */
const linesAround = ({ text, start, end }: TextSelection) => {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const next = text.indexOf("\n", end > start && text[end - 1] === "\n" ? end - 1 : end);
  const to = next === -1 ? text.length : next;
  return { from, to, lines: text.slice(from, to).split("\n") };
};

const replaceLines = (selection: TextSelection, change: (lines: string[]) => string[]): TextSelection => {
  const { from, to, lines } = linesAround(selection);
  const changed = change(lines).join("\n");
  return { text: selection.text.slice(0, from) + changed + selection.text.slice(to), start: from, end: from + changed.length };
};

/** Makes the lines a heading, or plain text again when they are one. */
export const toggleHeading = (selection: TextSelection): TextSelection =>
  replaceLines(selection, (lines) => {
    const all = lines.every((line) => /^##\s/.test(line));
    return lines.map((line) => (all ? line.replace(/^##\s+/, "") : `## ${line.replace(/^[-*]\s+/, "")}`));
  });

/** Makes the lines points in a list, or plain text again when they are. */
export const toggleList = (selection: TextSelection): TextSelection =>
  replaceLines(selection, (lines) => {
    const all = lines.filter((line) => line.trim() !== "").every((line) => /^[-*]\s/.test(line));
    return lines.map((line) => (line.trim() === "" ? line : all ? line.replace(/^[-*]\s+/, "") : `- ${line.replace(/^##\s+/, "")}`));
  });

/** Bold around what is selected; with nothing selected, a word to write over. */
export function makeBold({ text, start, end }: TextSelection): TextSelection {
  const chosen = text.slice(start, end) || "fet tekst";
  const added = `**${chosen}**`;
  return { text: text.slice(0, start) + added + text.slice(end), start: start + 2, end: start + 2 + chosen.length };
}

/** The address as a link may hold it: a web address (https:// added when it is left out), or an e-mail address. Null when it is neither. */
export function linkAddressOf(typed: string): string | null {
  const value = typed.trim();
  if (value === "" || /\s/.test(value) || /[()[\]<>"]/.test(value)) return null;
  if (/^https?:\/\/[^/]+\.[^/]+/i.test(value)) return value;
  if (/^mailto:[^@]+@[^@]+\.[^@]+$/i.test(value)) return value;
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(value)) return `mailto:${value}`;
  if (/^[^@/]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return null;
}

/** The selected words as a link to the address; with nothing selected, the address is the text. */
export function makeLink({ text, start, end }: TextSelection, address: string): TextSelection {
  const chosen = text.slice(start, end).replace(/\n/g, " ").trim() || address.replace(/^mailto:|^https?:\/\//, "");
  const added = `[${chosen}](${address})`;
  return { text: text.slice(0, start) + added + text.slice(end), start: start + added.length, end: start + added.length };
}
