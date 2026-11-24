import { EMAIL_SUBJECT_MAX, emailDraftError, type EmailDraft } from "./emailMessage";

// The e-mail that tests the sending from the admin page. It is the page's own e-mail when that can
// be sent, and otherwise a fixed, short one, so that a test works on an empty page too.

export const TEST_SUBJECT = "Test av e-post";
export const TEST_TEXT = [
  "Dette er en test fra siden «Send e-post» i administrasjonen.",
  "Den viser at e-post fra menigheten kommer fram. Du trenger ikke svare på den.",
].join("\n\n");

/** The draft a test is sent with: the page's draft when it is valid, otherwise the fixed test draft. */
export function testDraftFor(draft: EmailDraft, churchName: string): EmailDraft {
  if (emailDraftError(draft) === null) return { subject: draft.subject, text: draft.text, link: draft.link };
  const name = churchName.replace(/\s+/g, " ").trim();
  const subject = name ? `${TEST_SUBJECT} fra ${name}` : TEST_SUBJECT;
  return { subject: subject.length <= EMAIL_SUBJECT_MAX ? subject : TEST_SUBJECT, text: TEST_TEXT, link: "ingen" };
}
