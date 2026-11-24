import React from "react";
import { usableEmail } from "../../../../utils/emailRecipients";
import { studioCardPadded, studioInputFull, studioSecondaryButton } from "../../studioTheme";
import { fieldLabel } from "./emailStyles";

interface EmailSettingsProps {
  replyTo: string;
  onReplyTo: (replyTo: string) => void;
  /** The address as it is stored. */
  storedReplyTo: string;
  /** False while what is stored is being read. */
  loaded: boolean;
  onSave: () => void;
}

/** «Innstillinger»: the address the replies go to. */
export const EmailSettings: React.FC<EmailSettingsProps> = ({ replyTo, onReplyTo, storedReplyTo, loaded, onSave }) => (
  <section aria-label="Svaradresse" className={`${studioCardPadded} space-y-2`}>
    <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Innstillinger</h3>
    <label htmlFor="email-reply-to" className={fieldLabel}>
      Svar går til
    </label>
    <div className="flex flex-col sm:flex-row gap-2">
      <input id="email-reply-to" type="email" value={replyTo} onChange={(event) => onReplyTo(event.target.value)} placeholder="post@menigheten.no" className={`${studioInputFull} sm:max-w-sm`} />
      <button type="button" onClick={onSave} disabled={!loaded || (usableEmail(replyTo) ?? "") === storedReplyTo} className={`${studioSecondaryButton} disabled:opacity-50`}>
        Lagre
      </button>
    </div>
    <p className="text-[11px] text-[var(--studio-muted)] mt-2">
      E-posten sendes fra en adresse ingen leser. Den som svarer, når denne adressen.
      {loaded && storedReplyTo === "" && <strong className="text-amber-500"> Ingen adresse er lagret ennå.</strong>}
    </p>
  </section>
);
