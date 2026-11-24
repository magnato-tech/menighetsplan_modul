import React, { useState } from "react";
import { Send } from "lucide-react";
import type { Group, Person } from "../../../../types";
import { EMAIL_LINKS, type EmailDraft } from "../../../../utils/emailMessage";
import type { EmailRecipients } from "../../../../utils/emailRecipients";
import type { EmailList } from "../../../../utils/emailLists";
import { studioCardPadded, studioPrimaryButton, studioSecondaryButton } from "../../studioTheme";
import { ButtonMenu } from "./ButtonMenu";
import { ButtonOptions, type ButtonOptionsProps } from "./ButtonOptions";
import { EmailPreview } from "./EmailPreview";
import { EmailWriting } from "./EmailWriting";
import { RecipientField } from "./RecipientField";
import { TestPanel } from "./TestPanel";
import { countOf, people, type RecipientChip } from "./chips";
import { fieldLabel, hint } from "./emailStyles";

export interface EmailComposerProps {
  canSend: boolean;
  churchName: string;
  storedReplyTo: string;
  persons: Person[];
  groups: Group[];
  /** The saved lists, which «Til» suggests. */
  lists: EmailList[];
  chips: RecipientChip[];
  onChips: (chips: RecipientChip[]) => void;
  /** Who the chips reach, for the count and the list of those without an address. */
  recipients: EmailRecipients;
  draft: EmailDraft;
  setDraft: React.Dispatch<React.SetStateAction<EmailDraft>>;
  /** The ready-made texts for the «Mal» menu. */
  templates: { id: string; label: string }[];
  onTemplate: (id: string) => void;
  buttonProps: ButtonOptionsProps;
  /** What the login links do, said under the text, or null when they are off. */
  loginNote: string | null;
  previewLogin: { loginLink: boolean; loginLinkUntil?: string };
  sending: boolean;
  testing: boolean;
  onSend: () => void;
  testAddress: string;
  onTestAddress: (address: string) => void;
  testResult: { good: boolean; text: string } | null;
  onSendTest: () => void;
  onOpenSettings: () => void;
}

/** «Ny e-post»: the one that is written and sent to the chosen recipients. */
export const EmailComposer: React.FC<EmailComposerProps> = (props) => {
  const { canSend, churchName, storedReplyTo, persons, groups, lists, chips, onChips, recipients, draft, setDraft, templates, onTemplate, buttonProps, loginNote, previewLogin, sending, testing, onSend, testAddress, onTestAddress, testResult, onSendTest, onOpenSettings } = props;
  const [previewing, setPreviewing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [showWho, setShowWho] = useState(false);
  const { personCount, addressNote } = countOf(recipients);
  const missing = recipients.withoutEmail;
  const notes = [loginNote, missing.length > 0 ? `${people(missing.length)} mangler e-post: ${missing.map((person) => person.name).join(", ")}` : null].filter(Boolean).join(" · ");

  return (
    <section aria-label="Ny e-post" className={`${studioCardPadded} space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSend} disabled={sending || testing || !canSend} className={`${studioPrimaryButton} flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50`}>
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>{sending ? "Sender …" : `Send til ${people(personCount)}`}</span>
        </button>
        <button type="button" aria-expanded={testOpen} onClick={() => setTestOpen((current) => !current)} disabled={!canSend} className={`${studioSecondaryButton} disabled:opacity-50`}>
          Send prøve
        </button>
        <button type="button" aria-pressed={previewing} onClick={() => setPreviewing((current) => !current)} className={studioSecondaryButton}>
          Forhåndsvis
        </button>
        <div className="ml-auto">
          <ButtonMenu label="Mal ▾" ariaLabel="Maler">
            {(close) => (
              <div className="space-y-1">
                <p className={fieldLabel}>Start med</p>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onTemplate(template.id);
                      close();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            )}
          </ButtonMenu>
        </div>
      </div>

      <p className="text-[11px] text-[var(--studio-muted)]">
        <span className="font-bold">Fra: </span>
        {churchName}
        {storedReplyTo ? (
          <>
            {" "}
            · svar går til <span className="font-bold text-[var(--studio-text)]">{storedReplyTo}</span>
          </>
        ) : (
          <>
            {" "}
            ·{" "}
            <button type="button" onClick={onOpenSettings} className="font-bold text-amber-500 underline cursor-pointer">
              ingen svaradresse ennå
            </button>
          </>
        )}
      </p>

      <div>
        <label htmlFor="email-recipients" className={fieldLabel}>
          Til
        </label>
        <RecipientField chips={chips} onChips={onChips} persons={persons} groups={groups} lists={lists} summary={`${people(personCount)}${addressNote}`} />
        {chips.length > 0 && (
          <button
            type="button"
            id="btn-show-recipients"
            aria-expanded={showWho}
            onClick={() => setShowWho((open) => !open)}
            className="mt-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
          >
            {showWho ? "Skjul hvem som får e-posten" : `Vis hvem som får e-posten (${people(personCount)})`}
          </button>
        )}
        {chips.length > 0 && showWho && (
          <ul id="email-recipient-list" className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--studio-border)] divide-y divide-[var(--studio-border)] text-xs">
            {recipients.recipients.flatMap((recipient) =>
              recipient.personIds.map((personId) => (
                <li key={`${recipient.email}-${personId}`} className="px-3 py-1.5 flex flex-wrap gap-x-3">
                  <span className="font-bold text-[var(--studio-text)]">{persons.find((person) => person.id === personId)?.name ?? "Ukjent"}</span>
                  <span className="text-[var(--studio-muted)] break-all">{recipient.email}</span>
                </li>
              ))
            )}
            {recipients.withoutEmail.map((person) => (
              <li key={`uten-${person.id}`} className="px-3 py-1.5 flex flex-wrap gap-x-3">
                <span className="font-bold text-[var(--studio-text)]">{person.name}</span>
                <span className="text-red-400">mangler e-post, får den ikke</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {testOpen && (
        <TestPanel
          address={testAddress}
          onAddress={onTestAddress}
          testing={testing}
          disabled={!canSend || sending || testing}
          result={testResult}
          onSend={onSendTest}
          note="Sender en kort prøve til én adresse, med teksten under, eller en fast prøvetekst når den er tom. Går ikke til noen andre. Er «Logg mottakerne rett inn med knappen» krysset av, og adressen er et vanlig medlems, logger knappen i prøven inn som det medlemmet."
        />
      )}

      {previewing ? (
        <EmailPreview draft={draft} churchName={churchName} newsletter={false} banner={null} loginLink={previewLogin.loginLink} loginLinkUntil={previewLogin.loginLinkUntil} onBack={() => setPreviewing(false)} />
      ) : (
        <div className="space-y-4">
          <EmailWriting
            draft={draft}
            setDraft={setDraft}
            newsletter={false}
            toolbarEnd={
              <ButtonMenu label={`Knapp: ${EMAIL_LINKS[draft.link].label} ▾`} ariaLabel="Knappen i e-posten">
                {() => <ButtonOptions {...buttonProps} />}
              </ButtonMenu>
            }
          />
          {notes && <p className={hint}>{notes}</p>}
        </div>
      )}
    </section>
  );
};
