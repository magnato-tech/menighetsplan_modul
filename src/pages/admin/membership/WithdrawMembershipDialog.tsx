import React, { useState } from "react";
import type { Person } from "../../../types";
import { createWithdrawalClerkTask } from "../../../services/membershipClerkTasks";
import { reportWriteError } from "../../../services/writeErrors";

export const WithdrawMembershipDialog: React.FC<{
  person: Pick<Person, "id" | "name" | "congregationMember" | "denominationMember">;
  onClose: () => void;
  onCreated: () => void;
}> = ({ person, onClose, onCreated }) => {
  const [withdrawCongregation, setWithdrawCongregation] = useState(person.congregationMember === true);
  const [withdrawDenomination, setWithdrawDenomination] = useState(person.denominationMember === true);
  const [withdrawalDate, setWithdrawalDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createWithdrawalClerkTask(person, {
        withdrawCongregation,
        withdrawDenomination,
        withdrawalDate,
        comment: comment.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      reportWriteError("opprette oppgave", err);
      setError(err instanceof Error ? err.message : "Kunne ikke opprette oppgave.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-labelledby="withdraw-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] p-5 space-y-4 shadow-xl">
        <h2 id="withdraw-title" className="text-lg font-black text-[var(--studio-text)]">
          Meld ut {person.name}
        </h2>
        <p className="text-xs text-[var(--studio-muted)]">
          Oppretter en oppgave for protokollansvarlig: Cornerstone, bekreftelse og attest.
        </p>
        {person.congregationMember === true && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withdrawCongregation} onChange={(e) => setWithdrawCongregation(e.target.checked)} />
            Utmelding av menigheten
          </label>
        )}
        {person.denominationMember === true && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withdrawDenomination} onChange={(e) => setWithdrawDenomination(e.target.checked)} />
            Utmelding av trossamfunnet
          </label>
        )}
        <label className="block text-xs space-y-1">
          <span className="font-bold text-[var(--studio-muted)]">Utmeldingsdato</span>
          <input type="date" value={withdrawalDate} onChange={(e) => setWithdrawalDate(e.target.value)} className="w-full rounded-lg border border-[var(--studio-border)] px-2 py-1.5 text-sm bg-[var(--studio-bg)]" required />
        </label>
        <label className="block text-xs space-y-1">
          <span className="font-bold text-[var(--studio-muted)]">Kommentar</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--studio-border)] px-2 py-1.5 text-sm bg-[var(--studio-bg)]" />
        </label>
        {error && <p className="text-sm text-rose-600 font-semibold">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-[var(--studio-muted)]">
            Avbryt
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">
            Opprett oppgave
          </button>
        </div>
      </form>
    </div>
  );
};