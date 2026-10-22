/**
 * The text field with buttons (backlog 5) shows the text formatted, but the text is still stored with the
 * signs the website reads: ## and ### for headings, - and 1. for lists, **fet**, *kursiv*, `kode` and
 * [lenke](adresse). This file turns that text into the field's content and back, and tells whether a
 * text can go through the field unchanged; when it cannot, the field shows it as plain text instead.
 *
 * "full": a text block, where a line can be a heading or a list item. "inline": the text in a picture
 * with text, an info box or a card, where the website reads only fet, kursiv, kode and lenker, line by line.
 */

export type RichTextMode = "full" | "inline";

export type RichMark = { type: "bold" | "italic" | "code" } | { type: "link"; attrs: { href: string } };
export interface RichTextNode {
  type: "text";
  text: string;
  marks?: RichMark[];
}
export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<RichNode | RichTextNode>;
  text?: string;
  marks?: RichMark[];
}

const LINK = /\[(.*?)\]\((.*?)\)/g;
const STYLES = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;

/** The words of one line, read as the website reads them (renderInlineFormatting in CmsContentRenderer). */
export function parseInline(line: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  const styled = (part: string) => {
    for (const piece of part.split(STYLES)) {
      if (!piece) continue;
      if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**")) {
        nodes.push({ type: "text", text: piece.slice(2, -2), marks: [{ type: "bold" }] });
      } else if (piece.length > 2 && piece.startsWith("*") && piece.endsWith("*")) {
        nodes.push({ type: "text", text: piece.slice(1, -1), marks: [{ type: "italic" }] });
      } else if (piece.length > 2 && piece.startsWith("`") && piece.endsWith("`")) {
        nodes.push({ type: "text", text: piece.slice(1, -1), marks: [{ type: "code" }] });
      } else {
        nodes.push({ type: "text", text: piece });
      }
    }
  };
  let last = 0;
  for (const match of line.matchAll(LINK)) {
    styled(line.slice(last, match.index));
    if (match[1]) nodes.push({ type: "text", text: match[1], marks: [{ type: "link", attrs: { href: match[2] } }] });
    else nodes.push({ type: "text", text: match[0] });
    last = (match.index ?? 0) + match[0].length;
  }
  styled(line.slice(last));
  return nodes;
}

/** The words back into one line with signs. A link keeps only its words; fet wins over kursiv. */
export function serializeInline(content: Array<RichNode | RichTextNode> | undefined): string {
  let line = "";
  const nodes = (content ?? []).filter((node): node is RichTextNode => node.type === "text" && typeof node.text === "string");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const link = node.marks?.find((mark) => mark.type === "link") as { attrs: { href: string } } | undefined;
    if (link) {
      let words = node.text;
      while (i + 1 < nodes.length) {
        const next = nodes[i + 1].marks?.find((mark) => mark.type === "link") as { attrs: { href: string } } | undefined;
        if (next?.attrs.href !== link.attrs.href) break;
        words += nodes[++i].text;
      }
      line += `[${words}](${link.attrs.href})`;
      continue;
    }
    const has = (type: string) => node.marks?.some((mark) => mark.type === type);
    if (has("code")) line += `\`${node.text}\``;
    else if (has("bold")) line += `**${node.text}**`;
    else if (has("italic")) line += `*${node.text}*`;
    else line += node.text;
  }
  return line;
}

const paragraph = (line: string): RichNode => {
  const content = parseInline(line);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
};

const listItem = (line: string): RichNode => ({ type: "listItem", content: [paragraph(line)] });

/** The stored text as the field's content. */
export function richDocOf(text: string, mode: RichTextMode): RichNode {
  const lines = text.split("\n").map((line) => line.trim());
  const content: RichNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (mode === "full") {
      const heading = line.match(/^(#{1,3}) (.*)$/);
      if (heading) {
        const words = parseInline(heading[2]);
        content.push({ type: "heading", attrs: { level: heading[1].length }, ...(words.length ? { content: words } : {}) });
        continue;
      }
      const list = (pattern: RegExp, type: string) => {
        const items: RichNode[] = [];
        while (i < lines.length && pattern.test(lines[i])) items.push(listItem(lines[i++].replace(pattern, "")));
        i--;
        content.push({ type, content: items });
      };
      if (/^[-*] /.test(line)) {
        list(/^[-*] /, "bulletList");
        continue;
      }
      if (/^\d+\. /.test(line)) {
        list(/^\d+\. /, "orderedList");
        continue;
      }
    }
    content.push(paragraph(line));
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

/** The lines of a list, nested lists flattened into it, as the website shows only one level. */
function listLines(list: RichNode, ordered: boolean, out: string[]) {
  let number = 1;
  for (const item of list.content ?? []) {
    for (const child of (item as RichNode).content ?? []) {
      const node = child as RichNode;
      if (node.type === "bulletList" || node.type === "orderedList") listLines(node, node.type === "orderedList", out);
      else out.push(`${ordered ? `${number++}.` : "-"} ${serializeInline(node.content)}`);
    }
  }
}

/** The field's content back into the stored text. */
export function textOfRichDoc(doc: RichNode, mode: RichTextMode): string {
  const lines: string[] = [];
  for (const block of doc.content ?? []) {
    const node = block as RichNode;
    if (mode === "full" && node.type === "heading") {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2));
      lines.push(`${"#".repeat(level)} ${serializeInline(node.content)}`);
    } else if (mode === "full" && (node.type === "bulletList" || node.type === "orderedList")) {
      listLines(node, node.type === "orderedList", lines);
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      for (const item of node.content ?? []) for (const child of (item as RichNode).content ?? []) lines.push(serializeInline((child as RichNode).content));
    } else {
      lines.push(serializeInline(node.content));
    }
  }
  return lines.join("\n").trim();
}

/** The text as the field would store it again: lines trimmed, lists marked with - and numbered from 1. */
export function canonicalText(text: string, mode: RichTextMode): string {
  const lines = text.split("\n").map((line) => line.trim());
  let number = 0;
  return lines
    .map((line) => {
      if (mode !== "full") return line;
      if (/^\d+\. /.test(line)) return `${++number}. ${line.replace(/^\d+\. /, "")}`;
      number = 0;
      return line.replace(/^\* /, "- ");
    })
    .join("\n")
    .trim();
}

/** Signs for other kinds of blocks, which the field has no button for. */
const OTHER_BLOCKS = /^(:::|>|\||<|\[(?:Knapp|Handling|CTA):)/i;

/**
 * Whether the text can be shown formatted and stored again without any change the website would show.
 * When it cannot, the field shows it as plain text, so nothing is lost.
 */
export function fitsRichText(text: string, mode: RichTextMode): boolean {
  if (text.split("\n").some((line) => OTHER_BLOCKS.test(line.trim()))) return false;
  return textOfRichDoc(richDocOf(text, mode), mode) === canonicalText(text, mode);
}
