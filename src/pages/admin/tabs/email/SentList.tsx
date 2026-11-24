import React from "react";
import { formatNorwegianDateTime } from "../../../../utils/dates";
import type { EmailLogEntry, EmailRecord } from "../../../../utils/emailOutcome";
import { studioCardPadded, studioSecondaryButton } from "../../studioTheme";
import { people } from "./chips";

interface SentListProps {
  /** The log as it is stored, undefined while it is being read. */
  record: EmailRecord | undefined;
  /** Whether something is being sent: the actions wait. */
  busy: boolean;
  canSend: boolean;
  /** Sends to those a stopped sending left. */
  onSendRest: (entry: EmailLogEntry) => void;
}

/** «Sendte»: what has been sent from the page, newest first. The log holds no names or addresses. */
export const SentList: React.FC<SentListProps> = ({ record, busy, canSend, onSendRest }) => (
  <section aria-label="Sendt" className={studioCardPadded}>
    <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)] mb-3">Sendt</h3>
    {record === undefined ? (
      <p className="text-xs text-[var(--studio-muted)]">Henter loggen …</p>
    ) : record.log.length === 0 ? (
      <p className="text-xs text-[var(--studio-muted)] italic">Ingen e-post er sendt herfra ennå.</p>
    ) : (
      <ul className="divide-y divide-[var(--studio-border)]">
        {record.log.map((entry) => (
          <li key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--studio-text)] break-words">{entry.subject}</p>
              <p className="text-[11px] text-[var(--studio-muted)]">
                {formatNorwegianDateTime(entry.sentAt)} · Til: {entry.audienceLabel} · sendt til {people(entry.sent)}
                {entry.withoutEmail > 0 && ` · ${entry.withoutEmail} uten e-postadresse`}
              </p>
              {entry.remainingPersonIds.length > 0 && <p className="text-[11px] font-bold text-amber-500">Stoppet før alle hadde fått den: {people(entry.remainingPersonIds.length)} gjenstår.</p>}
            </div>
            {entry.remainingPersonIds.length > 0 && (
              <button type="button" onClick={() => onSendRest(entry)} disabled={busy || !canSend} className={`${studioSecondaryButton} shrink-0 disabled:opacity-50`}>
                Send til dem som gjenstår
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);
