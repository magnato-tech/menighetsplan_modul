import React from "react";

interface NotConfiguredNoticeProps {
  /** The names of the settings the installation lacks (see installation.ts). */
  missing: string[];
}

/**
 * Shown instead of the app when the installation has not been told which database it belongs
 * to. It is the one who sets the installation up that meets it, so it names what is missing.
 * It stands on its own: nothing of the app is drawn, so no database is read.
 */
export const NotConfiguredNotice: React.FC<NotConfiguredNoticeProps> = ({ missing }) => (
  <main style={{ maxWidth: "32rem", margin: "12vh auto", padding: "0 1.5rem", fontFamily: "system-ui, sans-serif", color: "#1c1917", lineHeight: 1.5 }}>
    <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>Denne installasjonen er ikke satt opp ennå</h1>
    <p style={{ marginBottom: "1rem" }}>
      Menighetsplan vet ikke hvilken database den hører til. Den som setter opp løsningen, må legge inn disse innstillingene og publisere på nytt:
    </p>
    <ul style={{ paddingLeft: "1.25rem", fontFamily: "ui-monospace, monospace", fontSize: "0.875rem" }}>
      {missing.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  </main>
);
