import React from "react";
import { studioCard } from "../../studioTheme";

export interface PaymentInfo {
  vippsNumber: string;
  vippsDescription: string;
  bankAccount: string;
  orgNumber: string;
}

/** The payment details the website shows (from the settings). Read here, and changed under Nettside-innstillinger. */
export const PaymentInfoSection: React.FC<{ info: PaymentInfo }> = ({ info }) => {
  const lines = [
    { label: "Vipps", value: info.vippsNumber },
    { label: "Vipps-beskrivelse", value: info.vippsDescription },
    { label: "Kontonummer", value: info.bankAccount },
    { label: "Organisasjonsnummer", value: info.orgNumber },
  ].filter((line) => line.value.trim() !== "");

  return (
    <section aria-labelledby="giving-payment-heading" className={`${studioCard} p-4 sm:p-5 space-y-3`}>
      <h3 id="giving-payment-heading" className="text-sm font-bold text-[var(--studio-text)]">
        Betalingsinformasjon
      </h3>
      {lines.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)]">Ingen betalingsinformasjon er lagt inn.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {lines.map((line) => (
            <React.Fragment key={line.label}>
              <dt className="font-bold text-[var(--studio-muted)]">{line.label}</dt>
              <dd className="text-[var(--studio-text)] break-words">{line.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      <p className="text-[11px] text-[var(--studio-muted)]">Endres under Nettside-innstillinger.</p>
    </section>
  );
};
