import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { MembershipClerkTask, Person } from "../../../types";
import { clerkTaskHeadline, closedTaskPatch } from "../../../utils/membershipClerkTasks";
import { formatNorwegianDateTime } from "../../../utils/dates";
import { updateClerkTask } from "../../../services/membershipClerkTasks";
import { reportWriteError } from "../../../services/writeErrors";
import { AddAddressToPerson } from "../tabs/AddAddressToPerson";
import { studioTabUrl } from "../studio";
import { TaskOwnerTag } from "./TaskOwnerTag";

const inputClass =
  "rounded-lg border border-[var(--studio-border)] px-2 py-1.5 text-sm bg-[var(--studio-bg)] text-[var(--studio-text)]";

/**
 * The card of a sign-in that was stopped by an address the register does not know (kind
 * loginUnknownEmail). The address is added to the person it belongs to, or the task is closed as
 * not one of ours. Shared addresses are not added here: each person gets an address of their own.
 */
export const LoginProblemTaskCard: React.FC<{
  task: MembershipClerkTask;
  persons: Person[];
  /** The name of the one who closes the task, as it is written on it. */
  clerkName: string;
  /** Whether the one who asks may add an address to a person: the register lets only an administrator do it. */
  mayAddAddress: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
  onCompleted: () => void;
}> = ({ task, persons, clerkName, mayAddAddress, busy, setBusy, onSaved, onError, onCompleted }) => {
  const [comment, setComment] = useState(task.comment ?? "");
  const address = task.loginAddress ?? "";
  const shared = task.loginReason === "shared";
  const attempts = task.attempts ?? 1;

  const close = async (added: string | undefined) => {
    setBusy(true);
    try {
      await updateClerkTask(task.id, closedTaskPatch({ comment: comment.trim() || undefined }, clerkName, new Date().toISOString(), added));
      onSaved("Oppgaven er utført.");
      onCompleted();
    } catch (error) {
      reportWriteError("lagre", error);
      onError("Kunne ikke lagre.");
    } finally {
      setBusy(false);
    }
  };

  const saveComment = async () => {
    setBusy(true);
    try {
      await updateClerkTask(task.id, { comment: comment.trim() || undefined });
      onSaved("Notat lagret.");
    } catch (error) {
      reportWriteError("lagre", error);
      onError("Kunne ikke lagre.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 sm:p-5 space-y-4">
      <div className="space-y-1 min-w-0 text-sm">
        <TaskOwnerTag kind={task.kind} />
        <h2 className="text-lg font-black text-[var(--studio-text)] leading-snug">{clerkTaskHeadline(task)}</h2>
        <p className="text-sm font-bold text-[var(--studio-text)] break-all">{address}</p>
        <p className="text-xs text-[var(--studio-muted)]">
          Siste forsøk {formatNorwegianDateTime(task.lastAttemptAt ?? task.createdAt)}
          {attempts > 1 ? ` (${attempts} forsøk)` : ""}
        </p>
      </div>

      <p className="text-sm text-[var(--studio-text)]">{task.instruction}</p>

      {shared ? (
        <div className="space-y-2">
          <Link to={studioTabUrl("planlegger-personer")} className="text-xs font-bold text-indigo-500">
            Åpne personene
          </Link>
          <p className="text-xs text-[var(--studio-muted)]">Søk etter {address} i Personer, og gi hver av dem sin egen adresse.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void close(undefined)}
            className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold disabled:opacity-50"
          >
            Ordnet
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {mayAddAddress ? (
            <AddAddressToPerson
              address={address}
              persons={persons}
              onAdded={() => undefined}
              onPersonAdded={(person) => void close(`Lagt til på ${person.name}.`)}
            />
          ) : (
            <p className="text-xs text-[var(--studio-muted)] max-w-xs">
              Bare en administrator kan legge adressen til på en person. Be en administrator om det, eller trykk «Ikke en av oss» når den ikke er en av menighetens.
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void close("Ikke en av oss.")}
            className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold disabled:opacity-50"
          >
            Ikke en av oss
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-bold text-[var(--studio-muted)]">Notat</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className={`${inputClass} w-full`} />
        </label>
        <button type="button" disabled={busy} onClick={saveComment} className="text-xs font-bold text-indigo-500">
          Lagre notat
        </button>
      </div>
    </div>
  );
};
