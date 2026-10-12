import React, { useState } from "react";
import { Clock, Plus } from "lucide-react";
import type { MemberProposal, Person } from "../../types";
import { duplicateProposalWarning, pendingProposals, proposalName, proposalOutcomeLabel } from "../../utils/memberProposals";

interface MemberProposalsProps {
  proposals: MemberProposal[];
  /** Leader or deputy: may send a name and take their own back. */
  canPropose: boolean;
  /** Administrator: may connect the name to a person, create one, or set it aside. */
  canDecide: boolean;
  /** People in the register who are not already in the group. */
  candidates: Person[];
  /** Names already in the group, for the duplicate warning. */
  memberNames: string[];
  proposedBy: string;
  onPropose: (name: string) => void;
  onWithdraw: (proposalId: string) => void;
  onAccept: (proposal: MemberProposal, personId: string) => void;
  onCreate: (proposal: MemberProposal) => void;
  onDismiss: (proposalId: string) => void;
}

/**
 * Waiting proposals, kept apart from the people who are already in the group.
 * Rendered only for a leader, a deputy or an administrator.
 */
export const MemberProposals: React.FC<MemberProposalsProps> = ({
  proposals,
  canPropose,
  canDecide,
  candidates,
  memberNames,
  proposedBy,
  onPropose,
  onWithdraw,
  onAccept,
  onCreate,
  onDismiss,
}) => {
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const waiting = pendingProposals(proposals);
  const outcomes = proposals.filter((proposal) => proposal.status !== "pending");
  const warning = duplicateProposalWarning(name, memberNames, waiting.map((proposal) => proposal.name));

  if (!canPropose && !canDecide) return null;
  if (!canPropose && proposals.length === 0) return null;

  const send = () => {
    const cleaned = proposalName(name);
    if (!cleaned) {
      setNotice("Skriv et navn.");
      return;
    }
    setNotice(null);
    setName("");
    onPropose(cleaned);
  };

  return (
    <div id="section-member-proposals" className="pt-3 border-t border-slate-200 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        <span>Venter på godkjenning</span>
      </h3>

      {waiting.length === 0 ? (
        <p className="text-[11px] opacity-70">Ingen forslag venter.</p>
      ) : (
        <ul className="space-y-2">
          {waiting.map((proposal) => (
            <li
              key={proposal.id}
              id={`proposal-row-${proposal.id}`}
              className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 shrink-0 text-amber-700" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{proposal.name}</p>
                    <p className="text-[11px] font-medium text-amber-800">Venter på godkjenning</p>
                  </div>
                </div>
                {canPropose && proposal.proposedBy === proposedBy && (
                  <button
                    type="button"
                    id={`btn-withdraw-proposal-${proposal.id}`}
                    onClick={() => onWithdraw(proposal.id)}
                    className="text-[11px] font-bold text-amber-900 hover:underline cursor-pointer"
                  >
                    Trekk tilbake
                  </button>
                )}
              </div>

              {canDecide && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id={`select-proposal-${proposal.id}`}
                    value={chosen[proposal.id] ?? ""}
                    onChange={(event) => setChosen((prev) => ({ ...prev, [proposal.id]: event.target.value }))}
                    className="text-xs px-2 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-800"
                  >
                    <option value="">Knytt til en person</option>
                    {candidates.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    id={`btn-accept-proposal-${proposal.id}`}
                    disabled={!chosen[proposal.id]}
                    onClick={() => onAccept(proposal, chosen[proposal.id])}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white disabled:opacity-40 cursor-pointer"
                  >
                    Legg til
                  </button>
                  <button
                    type="button"
                    id={`btn-create-proposal-${proposal.id}`}
                    onClick={() => onCreate(proposal)}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-amber-400 bg-white cursor-pointer"
                  >
                    Opprett «{proposal.name}»
                  </button>
                  <button
                    type="button"
                    id={`btn-dismiss-proposal-${proposal.id}`}
                    onClick={() => onDismiss(proposal.id)}
                    className="text-[11px] font-bold text-amber-900 hover:underline cursor-pointer"
                  >
                    Ikke legg til
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {outcomes.length > 0 && (
        <ul className="space-y-2">
          {outcomes.map((proposal) => (
            <li key={proposal.id} id={`proposal-outcome-${proposal.id}`} className="px-3 py-2 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold">{proposal.name}</span>
              <span className="ml-2 text-slate-500">{proposalOutcomeLabel(proposal.status)}</span>
            </li>
          ))}
        </ul>
      )}

      {canPropose && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className="sr-only" htmlFor="input-propose-member">
            Foreslå et medlem
          </label>
          <input
            id="input-propose-member"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Foreslå et medlem"
            maxLength={80}
            className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800"
          />
          <button
            type="submit"
            id="btn-propose-member"
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      )}
      {warning && <p className="text-[11px] text-amber-800">{warning}</p>}
      {notice && <p className="text-[11px] text-red-700">{notice}</p>}
    </div>
  );
};
