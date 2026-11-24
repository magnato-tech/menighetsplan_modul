import React, { useRef } from "react";
import { EMAIL_SUBJECT_MAX, EMAIL_TEXT_MAX, type EmailDraft } from "../../../../utils/emailMessage";
import { studioInputFull } from "../../studioTheme";
import { EmailTextToolbar } from "./EmailTextToolbar";
import { fieldLabel, hint } from "./emailStyles";

interface EmailWritingProps {
  draft: EmailDraft;
  setDraft: React.Dispatch<React.SetStateAction<EmailDraft>>;
  /** A newsletter has a taller text field and its own explanation. */
  newsletter: boolean;
  /** Put at the right of the toolbar, for example the «Knapp» menu. */
  toolbarEnd?: React.ReactNode;
}

/** The subject, and the text with its toolbar. Used by both the e-mail and the newsletter. */
export const EmailWriting: React.FC<EmailWritingProps> = ({ draft, setDraft, newsletter, toolbarEnd }) => {
  const textField = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <div>
        <label htmlFor="email-subject" className={fieldLabel}>
          Emne
        </label>
        <input
          id="email-subject"
          type="text"
          maxLength={EMAIL_SUBJECT_MAX}
          value={draft.subject}
          onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
          className={studioInputFull}
        />
      </div>

      <div>
        <label htmlFor="email-text" className={fieldLabel}>
          Tekst
        </label>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <EmailTextToolbar field={textField} onChange={(text) => setDraft((current) => ({ ...current, text }))} />
          {toolbarEnd}
        </div>
        <textarea
          ref={textField}
          id="email-text"
          rows={newsletter ? 16 : 9}
          maxLength={EMAIL_TEXT_MAX}
          value={draft.text}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
          className={`${studioInputFull} leading-relaxed`}
        />
        <p className={hint}>
          En tom linje gir nytt avsnitt. Merk tekst og trykk på en knapp over feltet for overskrift, fet skrift, lenke eller punktliste.{" "}
          {newsletter ? "Toppbildet og lenken til avmelding legges til av seg selv." : "Hilsenen med fornavn og knappen legges til av seg selv."}
        </p>
      </div>
    </>
  );
};
