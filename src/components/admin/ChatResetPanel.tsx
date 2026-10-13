import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2, MessageSquareOff } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";
import type { ShowFeedback } from "../../pages/admin/studio";
import { studioInputFull } from "../../pages/admin/studioTheme";
import { countGroupMessages, deleteGroupMessages } from "../../services/chatReset";

const ALL = "alle";
const messages = (count: number): string => `${count} ${count === 1 ? "melding" : "meldinger"}`;

/**
 * Empties the group chats: every group's, or one group's. For the administrator, before a new
 * season. It is asked about once more before anything is deleted, with the number it concerns.
 */
export const ChatResetPanel: React.FC<{ showFeedback: ShowFeedback }> = ({ showFeedback }) => {
  const { groups } = useFirebase();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [chosen, setChosen] = useState(ALL);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const count = () =>
    countGroupMessages().then(
      (found) => setCounts(found),
      () => setCounts(null)
    );
  useEffect(() => {
    void count();
  }, []);

  const withMessages = groups.filter((group) => (counts?.[group.id] ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name, "nb"));
  const total = counts === null ? null : Object.values(counts).reduce((sum, value) => sum + value, 0);
  const group = groups.find((candidate) => candidate.id === chosen);
  const concerned = chosen === ALL ? total : (counts?.[chosen] ?? 0);
  const where = chosen === ALL ? "alle gruppene" : `«${group?.name ?? "gruppen"}»`;

  const reset = async () => {
    setWorking(true);
    try {
      const deleted = await deleteGroupMessages(chosen === ALL ? null : chosen);
      showFeedback(`${messages(deleted)} i ${where} er slettet.`);
      setChosen(ALL);
    } catch (error) {
      showFeedback(error instanceof Error ? `Meldingene kunne ikke slettes: ${error.message}` : "Meldingene kunne ikke slettes.", "error");
    } finally {
      setConfirming(false);
      setWorking(false);
      void count();
    }
  };

  return (
    <section id="chat-reset" className="p-5 sm:p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
      <div>
        <h3 className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
          <MessageSquareOff className="w-4 h-4 text-[var(--studio-icon)]" />
          <span>Nullstill gruppechat</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] mt-0.5">
          Sletter meldingene i gruppenes chat, for eksempel før et nytt semester. Gruppene, deltakerne, samlingene og oppgavene røres ikke.
        </p>
      </div>

      {total === null ? (
        <p className="text-xs text-[var(--studio-muted)]">Teller meldingene …</p>
      ) : total === 0 ? (
        <p className="text-xs text-[var(--studio-muted)]">Ingen gruppe har meldinger i chatten.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block text-xs font-bold text-[var(--studio-text)] sm:flex-1">
              Hvilken chat
              <select
                value={chosen}
                onChange={(event) => {
                  setChosen(event.target.value);
                  setConfirming(false);
                }}
                className={`${studioInputFull} mt-1.5`}
              >
                <option value={ALL}>Alle gruppene ({messages(total)})</option>
                {withMessages.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({messages(counts?.[candidate.id] ?? 0)})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={confirming || working}
              className="px-4 py-2 rounded-xl border border-red-800 bg-red-950/60 hover:bg-red-900 text-red-200 text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
            >
              Nullstill …
            </button>
          </div>

          {confirming && (
            <div role="alertdialog" aria-labelledby="chat-reset-question" className="rounded-xl border border-red-800 bg-red-950/40 p-4 space-y-3">
              <p id="chat-reset-question" className="text-xs font-bold text-red-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                <span>
                  Slette {messages(concerned ?? 0)} i {where}? Deltakerne ser en tom chat etterpå. Det kan ikke angres.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void reset()}
                  disabled={working}
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {working && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  Ja, slett meldingene
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={working}
                  className="px-3.5 py-2 rounded-xl border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold cursor-pointer"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
