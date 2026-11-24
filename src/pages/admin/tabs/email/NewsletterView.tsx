import React, { useState } from "react";
import { Send } from "lucide-react";
import type { Person } from "../../../../types";
import type { EmailDraft } from "../../../../utils/emailMessage";
import type { EmailRecipients } from "../../../../utils/emailRecipients";
import type { ShowFeedback } from "../../studio";
import { studioCardPadded, studioInputFull, studioPrimaryButton, studioSecondaryButton } from "../../studioTheme";
import { EmailPreview } from "./EmailPreview";
import { EmailWriting } from "./EmailWriting";
import { NewsletterBannerCard } from "./NewsletterBannerCard";
import { NewsletterOptOutsCard } from "./NewsletterOptOutsCard";
import { TestPanel } from "./TestPanel";
import { countOf, people, type NewsletterKind } from "./chips";
import { fieldLabel, hint } from "./emailStyles";

export interface NewsletterViewProps {
  canSend: boolean;
  /** False while what is stored is being read: nothing is sent then. */
  ready: boolean;
  churchName: string;
  banner: string | null | undefined;
  /** Who has unsubscribed, for the card under the newsletter. Undefined or null while it is read or cannot be read. */
  optedOut: Pick<Person, "id" | "name" | "newsletterToken">[] | null | undefined;
  showFeedback: ShowFeedback;
  draft: EmailDraft;
  setDraft: React.Dispatch<React.SetStateAction<EmailDraft>>;
  kind: NewsletterKind;
  onKind: (kind: NewsletterKind) => void;
  /** The persons and addresses each newsletter audience reaches, for the choice. */
  counts: Record<NewsletterKind, { personCount: number; addressNote: string }>;
  recipients: EmailRecipients;
  sending: boolean;
  testing: boolean;
  onSend: () => void;
  testAddress: string;
  onTestAddress: (address: string) => void;
  testResult: { good: boolean; text: string } | null;
  onSendTest: () => void;
}

/** «Nyhetsbrev»: the same writing as an e-mail, to the members or everyone with an address, with the banner and the unsubscribe link. */
export const NewsletterView: React.FC<NewsletterViewProps> = (props) => {
  const { canSend, ready, churchName, banner, optedOut, showFeedback, draft, setDraft, kind, onKind, counts, recipients, sending, testing, onSend, testAddress, onTestAddress, testResult, onSendTest } = props;
  const [previewing, setPreviewing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const { personCount, addressNote } = countOf(recipients);
  const missing = recipients.withoutEmail;
  const notes = missing.length > 0 ? `${people(missing.length)} mangler e-post: ${missing.map((person) => person.name).join(", ")}` : null;

  return (
    <div className="space-y-6">
      <section aria-label="Nyhetsbrev" className={`${studioCardPadded} space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSend} disabled={sending || testing || !canSend || !ready} className={`${studioPrimaryButton} flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50`}>
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{sending ? "Sender …" : `Send til ${people(personCount)}`}</span>
          </button>
          <button type="button" aria-expanded={testOpen} onClick={() => setTestOpen((current) => !current)} disabled={!canSend} className={`${studioSecondaryButton} disabled:opacity-50`}>
            Send prøve
          </button>
          <button type="button" aria-pressed={previewing} onClick={() => setPreviewing((current) => !current)} className={studioSecondaryButton}>
            Forhåndsvis
          </button>
        </div>

        <div>
          <label htmlFor="email-audience" className={fieldLabel}>
            Til
          </label>
          <select id="email-audience" value={kind} onChange={(event) => onKind(event.target.value as NewsletterKind)} className={studioInputFull}>
            <option value="members">{`Medlemmer av menigheten · ${people(counts.members.personCount)}`}</option>
            <option value="everyone">{`Alle i registeret med e-post · ${people(counts.everyone.personCount)}`}</option>
          </select>
          <p id="email-recipient-count" className="text-[11px] text-[var(--studio-muted)] mt-2">
            <strong className="text-[var(--studio-text)]">{`${people(personCount)}${addressNote}`}</strong> får e-posten.
            {recipients.optedOut.length > 0 && ` ${people(recipients.optedOut.length)} har meldt seg av nyhetsbrevet.`}
          </p>
          <p className={hint}>Et nyhetsbrev får toppbildet øverst og en lenke nederst der mottakeren kan melde seg av. Medlemmer er de som er merket som medlem av menigheten i personregisteret.</p>
        </div>

        {testOpen && (
          <TestPanel
            address={testAddress}
            onAddress={onTestAddress}
            testing={testing}
            disabled={!canSend || sending || testing}
            result={testResult}
            onSend={onSendTest}
            note="Sender en kort prøve til én adresse, med teksten under, eller en fast prøvetekst når den er tom. Går ikke til noen andre."
          />
        )}

        {previewing ? (
          <EmailPreview draft={draft} churchName={churchName} newsletter banner={banner} loginLink={false} onBack={() => setPreviewing(false)} />
        ) : (
          <div className="space-y-4">
            <EmailWriting draft={draft} setDraft={setDraft} newsletter />
            {notes && <p className={hint}>{notes}</p>}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NewsletterBannerCard banner={banner} churchName={churchName} showFeedback={showFeedback} />
        <NewsletterOptOutsCard optedOut={optedOut} showFeedback={showFeedback} />
      </div>
    </div>
  );
};
