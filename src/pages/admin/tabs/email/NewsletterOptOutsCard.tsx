import React from "react";
import { optBackIn } from "../../../../services/newsletter";
import type { Person } from "../../../../types";
import type { ShowFeedback } from "../../studio";
import { studioCardPadded, studioSecondaryButton } from "../../studioTheme";

interface NewsletterOptOutsCardProps {
  /** The persons who have unsubscribed. Undefined while it is being read; null when it cannot be read. */
  optedOut: Pick<Person, "id" | "name" | "newsletterToken">[] | null | undefined;
  showFeedback: ShowFeedback;
}

/** Who has unsubscribed from the newsletter, and the way to let it go to them again. */
export const NewsletterOptOutsCard: React.FC<NewsletterOptOutsCardProps> = ({ optedOut, showFeedback }) => {
  const backIn = (person: Pick<Person, "name" | "newsletterToken">) => {
    if (!person.newsletterToken) return;
    if (!confirm(`Skal ${person.name} få nyhetsbrevet igjen? Gjør det bare når personen selv har bedt om det.`)) return;
    optBackIn(person.newsletterToken).then(
      () => showFeedback(`${person.name} får nyhetsbrevet igjen.`),
      () => showFeedback("Det gikk ikke å melde på igjen. Prøv igjen.", "error")
    );
  };

  return (
    <section aria-label="Meldt av nyhetsbrevet" className={`${studioCardPadded} space-y-2`}>
      <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Meldt av nyhetsbrevet</h3>
      {optedOut === undefined ? (
        <p className="text-xs text-[var(--studio-muted)]">Henter …</p>
      ) : optedOut === null ? (
        <p className="text-xs text-amber-500">Hvem som har meldt seg av, kan ikke leses før databasen har fått de nye reglene. Nyhetsbrev kan ikke sendes før det er gjort.</p>
      ) : optedOut.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)] italic">Ingen har meldt seg av.</p>
      ) : (
        <ul className="divide-y divide-[var(--studio-border)]">
          {optedOut.map((person) => (
            <li key={person.id} className="py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--studio-text)]">{person.name}</span>
              <button type="button" onClick={() => backIn(person)} className={`${studioSecondaryButton} shrink-0`}>
                Meld på igjen
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-[var(--studio-muted)]">Avmeldingen gjelder bare nyhetsbrevet. Beskjeder til ledere og grupper får de fortsatt.</p>
    </section>
  );
};
