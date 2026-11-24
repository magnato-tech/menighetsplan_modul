import { escapeHtml, type RenderedEmail } from "./emailMessage";

// The e-mail that answers a request for a sign-in link on Min side: either the link itself, or the
// news that the address is not in the register (server/signInEmail.ts writes the texts). It has
// the look of the other e-mails from the congregation (see renderEmail in emailMessage.ts), but its
// own words, so it has no greeting, footer or closing of its own: the parts are all there is.

/** One part of the e-mail, in order: a paragraph of text, or the button. */
export type SignInEmailPart = { text: string } | { button: { label: string; url: string } };

export interface SignInEmailToRender {
  subject: string;
  churchName: string;
  parts: SignInEmailPart[];
}

const BUTTON_STYLE = "display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:10px;";

/** The e-mail as it is sent: once as plain text, once dressed for the inbox. Nothing in the parts is read as HTML. */
export function renderSignInEmail({ subject, churchName, parts }: SignInEmailToRender): RenderedEmail {
  const text = parts.map((part) => ("text" in part ? part.text : `${part.button.label}: ${part.button.url}`)).join("\n\n");
  const body = parts
    .map((part) =>
      "text" in part
        ? `<p style="margin:12px 0;">${escapeHtml(part.text)}</p>`
        : `<p style="margin:16px 0;"><a href="${escapeHtml(part.button.url)}" style="${BUTTON_STYLE}">${escapeHtml(part.button.label)}</a></p>`
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<tr><td style="padding:24px 28px 8px 28px;font-size:13px;font-weight:bold;color:#047857;">${escapeHtml(churchName)}</td></tr>
<tr><td style="padding:12px 28px 24px 28px;font-size:16px;line-height:24px;">
${body}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
