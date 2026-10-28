import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { DEMO } from "../../demo";
import { studioTabUrl } from "../../pages/admin/studio";
import { requestEmail, saveEmailLog, subscribeEmailRecord } from "../../services/email";
import { formatNorwegianDateTime } from "../../utils/dates";
import { emailDraftError } from "../../utils/emailMessage";
import { recentSameSending, stopMessage, withLogEntry, type EmailLogEntry, type EmailRecord } from "../../utils/emailOutcome";
import { audienceKey, type EmailAudience } from "../../utils/emailRecipients";
import { mailPeopleOf, mailSubjectOf } from "../../utils/gatheringMail";
import { newId } from "../../utils/id";
import type { Assignment, Gathering, Person, Task } from "../../types";

interface GatheringMailDialogProps {
  gathering: Gathering;
  tasks: Task[];
  assignments: Assignment[];
  persons: Person[];
  /** Called with how many got the e-mail. The dialog is closed by the one who opened it. */
  onSent: (count: number) => void;
  onClose: () => void;
  now?: () => Date;
}

/** The people on the gathering: given as the audience, and named when the e-mail is sent. Never a newsletter. */
const AUDIENCE: EmailAudience = { kind: "persons" };
const people = (count: number): string => (count === 1 ? "1 person" : `${count} personer`);
const fieldClass = "w-full text-sm text-slate-800 rounded-lg border border-slate-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500";

/**
 * E-mail to everyone on a gathering: those with an open assignment on it (confirmed or pending). It is written
 * and sent the way the e-mail tab does it, to a single audience that is not a newsletter. Escape, the close
 * button and a press on the backdrop close it.
 */
export const GatheringMailDialog: React.FC<GatheringMailDialogProps> = ({ gathering, tasks, assignments, persons, onSent, onClose, now = () => new Date() }) => {
  // undefined while the record is read, null when it cannot be read: then nothing is sent, so the log is not overwritten
  const [record, setRecord] = useState<EmailRecord | null | undefined>(undefined);
  const [subject, setSubject] = useState(() => mailSubjectOf(gathering));
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeEmailRecord((stored) => setRecord(stored), () => setRecord(null)), []);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const everyone = useMemo(
    () => mailPeopleOf(new Set(tasks.filter((task) => task.gatheringId === gathering.id).map((task) => task.id)), assignments, persons),
    [tasks, gathering.id, assignments, persons]
  );
  const reachable = everyone.filter((person) => person.address !== null).length;
  const canSend = DEMO === null && record !== undefined && record !== null && record.replyTo !== "";

  const send = async () => {
    if (!canSend || !record || busy) return;
    const wrong = emailDraftError({ subject, text, link: "minside" }) ?? (reachable === 0 ? "Ingen av dem har en e-postadresse." : null);
    setError(wrong);
    if (wrong) return;
    const before = recentSameSending(record.log, audienceKey, AUDIENCE, subject, now());
    if (before && !confirm(`Denne e-posten ble sendt til «${before.audienceLabel}» ${formatNorwegianDateTime(before.sentAt)}. Vil du sende den en gang til?`)) return;
    if (!confirm(`Du sender «${subject.trim()}» til ${people(reachable)}. Vil du sende?`)) return;

    setBusy(true);
    setError(null);
    const outcome = await requestEmail({
      subject: subject.trim(),
      text: text.trim(),
      link: "minside",
      mode: "send",
      audience: AUDIENCE,
      onlyPersonIds: everyone.map((person) => person.id),
    });
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);

    const entry: EmailLogEntry = {
      id: newId("epost"),
      sentAt: now().toISOString(),
      audience: AUDIENCE,
      audienceLabel: mailSubjectOf(gathering),
      subject: subject.trim(),
      sent: outcome.sent,
      withoutEmail: outcome.withoutEmail,
      stopped: outcome.stopped,
      remainingPersonIds: outcome.remainingPersonIds,
    };
    saveEmailLog(withLogEntry(record.log, entry)).catch(() => setError("E-posten er sendt, men loggen kunne ikke lagres."));
    if (outcome.stopped) {
      setError(`${outcome.sent > 0 ? `${people(outcome.sent)} fikk e-posten. ` : ""}${stopMessage(outcome.stopped, outcome.remainingPersonIds.length, outcome.detail)}`);
      return;
    }
    onSent(outcome.sent);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="gathering-mail-title" className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="gathering-mail-title" className="text-base font-extrabold text-slate-900">
            E-post til alle som er med
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Lukk"
            onClick={onClose}
            className="w-11 h-11 -mt-2 -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">{people(everyone.length)}</p>
            {everyone.length > 0 && (
              <button
                type="button"
                aria-expanded={listOpen}
                aria-controls="gathering-mail-people"
                onClick={() => setListOpen((open) => !open)}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
              >
                {listOpen ? "Skjul navnene" : "Vis navnene"}
              </button>
            )}
          </div>
          {listOpen && (
            <ul id="gathering-mail-people" className="text-sm text-slate-700 space-y-0.5 max-h-40 overflow-y-auto">
              {everyone.map((person) => (
                <li key={person.id}>
                  {person.name}
                  {person.address === null && <span className="text-slate-500"> (uten e-post)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block">
          <span className="block text-xs font-bold text-slate-600 mb-1">Emne</span>
          <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-600 mb-1">Tekst</span>
          <textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} className={fieldClass} />
        </label>

        {record !== undefined && !canSend && (
          <p className="text-xs text-slate-700">
            {DEMO !== null ? (
              "Demoen sender ikke e-post."
            ) : (
              <>
                E-post er ikke satt opp her ennå.{" "}
                <Link to={studioTabUrl("epost")} onClick={onClose} className="font-semibold text-indigo-700 underline">
                  Send e-post
                </Link>
              </>
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer">
            Avbryt
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend || busy || reachable === 0}
            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg cursor-pointer"
          >
            {busy ? "Sender …" : "Send"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
