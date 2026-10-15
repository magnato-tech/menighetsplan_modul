import type { EmailAudience } from "./emailRecipients";

// The e-mail an administrator sends to leaders, volunteers and, as a newsletter, to the members:
// what it may hold, the ready-made texts, and how it looks in the inbox. Used by the admin page,
// and where the e-mail is sent.

/** Where the button in the e-mail leads: the leader's page, Min side, or no button at all. */
export type EmailLink = "leder" | "minside" | "ingen";

export const EMAIL_LINKS: Record<EmailLink, { path: string | null; button: string; label: string }> = {
  leder: { path: "/leder", button: "Åpne gruppene mine", label: "Gruppelederens side" },
  minside: { path: "/minside", button: "Åpne Min side", label: "Min side" },
  ingen: { path: null, button: "", label: "Ingen knapp" },
};

export interface EmailDraft {
  subject: string;
  /**
   * The text, with a few marks the toolbar on the admin page writes: "## " starts a heading,
   * "- " a point in a list, **bold**, and [text](https://address) a link. An empty line starts a
   * new paragraph. Nothing else in it is read as anything but text.
   */
  text: string;
  link: EmailLink;
}

export const EMAIL_SUBJECT_MAX = 120;
export const EMAIL_TEXT_MAX = 10000;

export interface EmailTemplate extends EmailDraft {
  id: string;
  label: string;
  audience: EmailAudience;
}

/** The ready-made texts: the start of a term, and a newsletter to fill in. The administrator may change every word. */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "semesterstart-ledere",
    label: "Semesterstart: til lederne",
    audience: { kind: "leaders" },
    link: "leder",
    subject: "Nytt semester: legg inn oppgavene for gruppa di",
    text: [
      "Planen for det nye semesteret er lagt inn, og nå er det din tur.",
      "Gå inn på gruppa di og se over arrangementene framover. Legg inn oppgavene som trengs, og spør dem du ønsker å ha med. Det du lar stå åpent, kan de frivillige ta selv når vi gir dem beskjed.",
      "Du logger inn med e-postadressen denne e-posten kom til.",
    ].join("\n\n"),
  },
  {
    id: "oppgaver-klare",
    label: "Oppgavene er klare: til de frivillige",
    audience: { kind: "serviceGroups" },
    link: "minside",
    subject: "Oppgavene for semesteret er klare",
    text: [
      "Nå ligger oppgavene for semesteret ute.",
      "Gå inn på Min side. Der ser du forespørsler som venter på svar fra deg, og ledige oppgaver i gruppene du er med i. Ta de dagene som passer for deg.",
      "Du logger inn med e-postadressen denne e-posten kom til.",
    ].join("\n\n"),
  },
  {
    id: "nyhetsbrev",
    label: "Nyhetsbrev",
    audience: { kind: "members" },
    link: "ingen",
    subject: "Nyhetsbrev",
    text: ["## Kjære alle sammen!", "Skriv nyhetsbrevet her.", "## Hva skjer", "- Første punkt\n- Andre punkt"].join("\n\n"),
  },
];

/** What is wrong with a draft, said to the administrator, or null when it can be sent. */
export function emailDraftError(draft: { subject?: unknown; text?: unknown; link?: unknown }): string | null {
  const subject = typeof draft.subject === "string" ? draft.subject.trim() : "";
  const text = typeof draft.text === "string" ? draft.text.trim() : "";
  if (subject === "") return "E-posten må ha et emne.";
  if (/[\r\n]/.test(subject)) return "Emnet kan ikke gå over flere linjer.";
  if (subject.length > EMAIL_SUBJECT_MAX) return `Emnet kan ikke være lengre enn ${EMAIL_SUBJECT_MAX} tegn.`;
  if (text === "") return "E-posten må ha en tekst.";
  if (text.length > EMAIL_TEXT_MAX) return `Teksten kan ikke være lengre enn ${EMAIL_TEXT_MAX} tegn.`;
  if (typeof draft.link !== "string" || !Object.keys(EMAIL_LINKS).includes(draft.link)) return "Velg hvor knappen i e-posten skal føre.";
  return null;
}

/** The draft a request holds, tidied, or null when it cannot be sent. */
export function toEmailDraft(value: { subject?: unknown; text?: unknown; link?: unknown }): EmailDraft | null {
  if (emailDraftError(value) !== null) return null;
  return { subject: (value.subject as string).trim(), text: (value.text as string).trim().replace(/\r\n/g, "\n"), link: value.link as EmailLink };
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ---------- The marks in the text ----------

/** One part of the text: a heading, a paragraph (its lines), or a list (its points). */
export type EmailBlock = { kind: "heading"; text: string } | { kind: "paragraph"; lines: string[] } | { kind: "list"; items: string[] };

const HEADING = /^##\s+(.*)$/;
const POINT = /^[-*]\s+(.*)$/;

/** The text as headings, paragraphs and lists. A heading is always a part of its own; an empty line ends a paragraph or a list. */
export function emailBlocksOf(text: string): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  let open: EmailBlock | null = null;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    const point = POINT.exec(line);
    if (line === "") open = null;
    else if (heading) {
      blocks.push({ kind: "heading", text: heading[1].trim() });
      open = null;
    } else if (point) {
      if (open?.kind !== "list") blocks.push((open = { kind: "list", items: [] }));
      open.items.push(point[1].trim());
    } else {
      if (open?.kind !== "paragraph") blocks.push((open = { kind: "paragraph", lines: [] }));
      open.lines.push(line);
    }
  }
  return blocks;
}

// A link may lead to a web page or open an e-mail; nothing else becomes a link
const LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g;
const BOLD = /\*\*([^*\n]+?)\*\*/g;
const LINK_STYLE = "color:#047857;text-decoration:underline;";

/** One line as HTML: everything escaped first, so what is written is never read as HTML, then bold and links. */
export function inlineHtml(line: string): string {
  return escapeHtml(line)
    .replace(LINK, (_, text: string, url: string) => `<a href="${url}" style="${LINK_STYLE}">${text}</a>`)
    .replace(BOLD, "<strong>$1</strong>");
}

/** One line as plain text: the marks taken out, and a link written as "text (address)". */
export const inlineText = (line: string): string => line.replace(LINK, (_, text: string, url: string) => `${text} (${url.replace(/^mailto:/, "")})`).replace(BOLD, "$1");

const blockHtml = (block: EmailBlock): string => {
  if (block.kind === "heading") return `<h2 style="margin:22px 0 8px 0;font-size:20px;line-height:26px;color:#0f172a;">${inlineHtml(block.text)}</h2>`;
  if (block.kind === "list") return `<ul style="margin:12px 0;padding-left:22px;">${block.items.map((item) => `<li style="margin:4px 0;">${inlineHtml(item)}</li>`).join("")}</ul>`;
  return `<p style="margin:12px 0;">${block.lines.map(inlineHtml).join("<br>")}</p>`;
};

const blockText = (block: EmailBlock): string => {
  if (block.kind === "heading") return inlineText(block.text).toLocaleUpperCase("nb");
  if (block.kind === "list") return block.items.map((item) => `- ${inlineText(item)}`).join("\n");
  return block.lines.map(inlineText).join("\n");
};

// ---------- The e-mail ----------

export interface EmailToRender {
  draft: EmailDraft;
  churchName: string;
  /** Where the installation is, "https://menigheten.example". The button leads to a page there. */
  siteUrl: string;
  /** The first name of the one it goes to. Null greets nobody by name. */
  firstName: string | null;
  /**
   * Set for a newsletter: the link that unsubscribes the one it goes to, and the banner's address
   * (null shows the congregation's name instead). A newsletter has no greeting or closing of its
   * own: the administrator writes them.
   */
  newsletter?: { unsubscribeUrl: string; bannerUrl: string | null };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** The e-mail as it is sent: once as plain text, once dressed for the inbox. Nothing the administrator wrote is read as HTML. */
export function renderEmail({ draft, churchName, siteUrl, firstName, newsletter }: EmailToRender): RenderedEmail {
  const link = EMAIL_LINKS[draft.link];
  const url = link.path ? siteUrl.replace(/\/+$/, "") + link.path : null;
  const greeting = newsletter ? null : firstName ? `Hei ${firstName}!` : "Hei!";
  const closing = newsletter ? null : `Hilsen ${churchName}`;
  const blocks = emailBlocksOf(draft.text);
  const footer = newsletter
    ? `Du får dette nyhetsbrevet fra ${churchName}.`
    : `Du får denne e-posten fordi du står i en gruppe i ${churchName}. Du kan svare på den hvis du lurer på noe.`;

  const text = [
    greeting,
    ...blocks.map(blockText),
    url ? `${link.button}: ${url}` : null,
    closing,
    newsletter ? `${footer} Meld deg av: ${newsletter.unsubscribeUrl}` : footer,
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n");

  const header = newsletter?.bannerUrl
    ? `<tr><td style="padding:0;"><img src="${escapeHtml(newsletter.bannerUrl)}" alt="${escapeHtml(churchName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0;"></td></tr>`
    : `<tr><td style="padding:24px 28px 8px 28px;font-size:13px;font-weight:bold;color:#047857;">${escapeHtml(churchName)}</td></tr>`;

  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${newsletter ? 600 : 520}px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
${header}
<tr><td style="padding:${newsletter ? "12px" : "0"} 28px 8px 28px;font-size:16px;line-height:24px;">
${greeting ? `<p style="margin:12px 0;">${escapeHtml(greeting)}</p>\n` : ""}${blocks.map(blockHtml).join("\n")}
</td></tr>
${
  url
    ? `<tr><td style="padding:8px 28px 24px 28px;">
<a href="${escapeHtml(url)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:10px;">${escapeHtml(link.button)}</a>
</td></tr>
`
    : ""
}${closing ? `<tr><td style="padding:0 28px 24px 28px;font-size:16px;line-height:24px;">${escapeHtml(closing)}</td></tr>\n` : ""}<tr><td style="padding:16px 28px 22px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;">${escapeHtml(footer)}${
    newsletter ? ` <a href="${escapeHtml(newsletter.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Meld deg av</a>` : ""
  }</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: draft.subject, html, text };
}
