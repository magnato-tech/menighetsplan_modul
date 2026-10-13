import type { EmailAudience } from "./emailRecipients";

// The e-mail an administrator sends to leaders and volunteers: what it may hold, the ready-made
// texts, and how it looks in the inbox. Used by the admin page, and where the e-mail is sent.

/** Where the button in the e-mail leads: the leader's page, or Min side. */
export type EmailLink = "leder" | "minside";

export const EMAIL_LINKS: Record<EmailLink, { path: string; button: string; label: string }> = {
  leder: { path: "/leder", button: "Åpne gruppene mine", label: "Gruppelederens side" },
  minside: { path: "/minside", button: "Åpne Min side", label: "Min side" },
};

export interface EmailDraft {
  subject: string;
  /** Plain text. An empty line starts a new paragraph. */
  text: string;
  link: EmailLink;
}

export const EMAIL_SUBJECT_MAX = 120;
export const EMAIL_TEXT_MAX = 3000;

export interface EmailTemplate extends EmailDraft {
  id: string;
  label: string;
  audience: EmailAudience;
}

/** The texts that are ready to send at the start of a term. The administrator may change every word. */
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
  if (draft.link !== "leder" && draft.link !== "minside") return "Velg hvor knappen i e-posten skal føre.";
  return null;
}

/** The draft a request holds, tidied, or null when it cannot be sent. */
export function toEmailDraft(value: { subject?: unknown; text?: unknown; link?: unknown }): EmailDraft | null {
  if (emailDraftError(value) !== null) return null;
  return { subject: (value.subject as string).trim(), text: (value.text as string).trim().replace(/\r\n/g, "\n"), link: value.link as EmailLink };
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export interface EmailToRender {
  draft: EmailDraft;
  churchName: string;
  /** Where the installation is, "https://menigheten.example". The button leads to a page there. */
  siteUrl: string;
  /** The first name of the one it goes to. Null greets nobody by name. */
  firstName: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** The e-mail as it is sent: once as plain text, once dressed for the inbox. Nothing the administrator wrote is read as HTML. */
export function renderEmail({ draft, churchName, siteUrl, firstName }: EmailToRender): RenderedEmail {
  const link = EMAIL_LINKS[draft.link];
  const url = siteUrl.replace(/\/+$/, "") + link.path;
  const greeting = firstName ? `Hei ${firstName}!` : "Hei!";
  const paragraphs = paragraphsOf(draft.text);
  const footer = `Du får denne e-posten fordi du står i en gruppe i ${churchName}. Du kan svare på den hvis du lurer på noe.`;

  const text = [greeting, ...paragraphs, `${link.button}: ${url}`, `Hilsen ${churchName}`, footer].join("\n\n");

  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<tr><td style="padding:24px 28px 8px 28px;font-size:13px;font-weight:bold;color:#047857;">${escapeHtml(churchName)}</td></tr>
<tr><td style="padding:0 28px 8px 28px;font-size:16px;line-height:24px;">
<p style="margin:12px 0;">${escapeHtml(greeting)}</p>
${paragraphs.map((paragraph) => `<p style="margin:12px 0;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("\n")}
</td></tr>
<tr><td style="padding:8px 28px 24px 28px;">
<a href="${escapeHtml(url)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:10px;">${escapeHtml(link.button)}</a>
</td></tr>
<tr><td style="padding:0 28px 24px 28px;font-size:16px;line-height:24px;">Hilsen ${escapeHtml(churchName)}</td></tr>
<tr><td style="padding:16px 28px 22px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: draft.subject, html, text };
}
