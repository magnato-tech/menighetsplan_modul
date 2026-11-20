import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { MembershipApplication, MembershipClerkTask, Person } from "../../../types";
import { clerkTaskHeadline } from "../../../utils/membershipClerkTasks";
import { formatBirthDate } from "../../../utils/birthDate";
import { membershipApplicationAdminPath } from "../../../services/membershipApplications";
import {
  completeMembershipApplication,
  markMembershipApplicationCornerstone,
  receiveMembershipApplication,
  revertMembershipApplicationClerkStep,
} from "../../../services/membershipApplications";
import {
  completeDateCorrectionTask,
  completeWithdrawalTask,
  recordWithdrawalAttestationDelivery,
  updateClerkTask,
} from "../../../services/membershipClerkTasks";
import { downloadWithdrawalAttestation } from "../../../utils/withdrawalAttestation";
import { canSendWithdrawalAttestationEmail } from "../../../utils/withdrawalAttestationDelivery";
import { sendWithdrawalAttestationEmail } from "../../../services/withdrawalAttestationEmail";
import { canCompleteClerkTask, cornerstoneDoneForTask } from "../../../utils/membershipProtocolLog";
import { DEMO } from "../../../demo";
import { reportWriteError } from "../../../services/writeErrors";

const inputClass =
  "rounded-lg border border-[var(--studio-border)] px-2 py-1.5 text-sm bg-[var(--studio-bg)] text-[var(--studio-text)]";

export const MembershipClerkTaskCard: React.FC<{
  task: MembershipClerkTask;
  application: MembershipApplication | null;
  person?: Pick<Person, "denominationEnrollmentType">;
  churchName: string;
  personBirthDate?: string;
  personEmail?: string;
  clerkId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
  onCompleted: () => void;
}> = ({
  task,
  application,
  person,
  churchName,
  personBirthDate,
  personEmail,
  clerkId,
  busy,
  setBusy,
  onSaved,
  onError,
  onCompleted,
}) => {
  const [comment, setComment] = useState(task.comment ?? "");
  const [correctedDate, setCorrectedDate] = useState(task.correctedEnrollmentDate ?? "");
  const [noteOpen, setNoteOpen] = useState(false);

  const category = person?.denominationEnrollmentType ?? "–";
  const virkningsdato =
    task.kind === "withdrawal"
      ? task.withdrawalDate
        ? formatBirthDate(task.withdrawalDate)
        : "–"
      : task.kind === "correctEnrollmentDate"
        ? "31.12.2010"
        : application
          ? formatBirthDate(application.submittedAt.slice(0, 10))
          : formatBirthDate(task.createdAt.slice(0, 10));

  const step1Done = cornerstoneDoneForTask(task, application);

  const patchTask = async (patch: Partial<MembershipClerkTask>, label = "Lagret.") => {
    setBusy(true);
    try {
      await updateClerkTask(task.id, patch);
      onSaved(label);
    } catch (error) {
      reportWriteError("lagre", error);
      onError("Kunne ikke lagre.");
    } finally {
      setBusy(false);
    }
  };

  const setCornerstone = async (checked: boolean) => {
    if (task.kind === "application" && application) {
      setBusy(true);
      try {
        if (checked) {
          if (application.status === "submitted") {
            await receiveMembershipApplication(application, clerkId);
          }
          const fresh = {
            ...application,
            status: application.status === "submitted" ? ("received" as const) : application.status,
          };
          if (fresh.status === "received") {
            await markMembershipApplicationCornerstone(fresh, clerkId);
          }
          onSaved("Cornerstone registrert.");
        } else {
          await revertMembershipApplicationClerkStep(application);
          await updateClerkTask(task.id, { cornerstoneUpdated: false });
          onSaved("Cornerstone avkrysset.");
        }
      } catch (error) {
        reportWriteError("lagre", error);
        onError("Kunne ikke lagre Cornerstone.");
      } finally {
        setBusy(false);
      }
      return;
    }
    await patchTask({ cornerstoneUpdated: checked });
  };

  const emailAttestation = async () => {
    const check = canSendWithdrawalAttestationEmail(task, personEmail);
    if (!check.ok) {
      onError(check.reason);
      return;
    }
    setBusy(true);
    try {
      const { to, copyTo } = await sendWithdrawalAttestationEmail(task, clerkId);
      onSaved(`Attest sendt til ${to} (kopi til ${copyTo}).`);
    } catch (error) {
      reportWriteError("sende e-post", error);
      onError(error instanceof Error ? error.message : "Kunne ikke sende attest.");
    } finally {
      setBusy(false);
    }
  };

  const downloadAttest = async () => {
    downloadWithdrawalAttestation(
      {
        churchName,
        person: { name: task.personName, birthDate: personBirthDate },
        withdrawCongregation: task.withdrawCongregation === true,
        withdrawDenomination: task.withdrawDenomination === true,
        withdrawalDate: task.withdrawalDate ?? new Date().toISOString().slice(0, 10),
      },
      `utmeldingsattest-${task.personName.replace(/\s+/g, "-")}`
    );
    if (!task.attestationPosted) {
      await recordWithdrawalAttestationDelivery(task, clerkId, { channel: "post" });
      onSaved("Attest lastet ned – brevpost registrert.");
    }
  };

  const saveComment = async () => {
    await patchTask({ comment: comment.trim() || undefined }, "Notat lagret.");
  };

  const finish = async () => {
    const ready = canCompleteClerkTask(
      { ...task, applicationArchiveConfirmed: task.applicationArchiveConfirmed, cornerstoneUpdated: step1Done ? true : task.cornerstoneUpdated },
      correctedDate,
      application
    );
    if (!ready.ok) {
      onError(ready.reason);
      return;
    }
    setBusy(true);
    try {
      if (task.kind === "withdrawal") {
        await completeWithdrawalTask(
          {
            ...task,
            comment: comment.trim() || undefined,
            cornerstoneUpdated: true,
            attestationEmailedAt: task.attestationEmailedAt,
            attestationPosted: task.attestationPosted,
            attestationSent: task.attestationSent,
          },
          clerkId
        );
      } else if (task.kind === "correctEnrollmentDate") {
        await completeDateCorrectionTask(
          { ...task, comment: comment.trim() || undefined, cornerstoneUpdated: true },
          correctedDate,
          clerkId
        );
      } else if (application) {
        await completeMembershipApplication(application, clerkId);
      }
      onSaved("Oppgaven er utført.");
      onCompleted();
    } catch (error) {
      reportWriteError("lagre", error);
      onError(error instanceof Error ? error.message : "Kunne ikke fullføre.");
    } finally {
      setBusy(false);
    }
  };

  const canFinish = canCompleteClerkTask(
    { ...task, cornerstoneUpdated: step1Done ? true : task.cornerstoneUpdated },
    correctedDate,
    application
  ).ok;

  const headline = clerkTaskHeadline(task, application);

  return (
    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-black text-[var(--studio-text)] leading-snug">{headline}</h2>
          <p className="text-sm font-bold text-[var(--studio-text)]">{task.personName}</p>
          <p className="text-xs text-[var(--studio-muted)]">
            Kat. {category} · Virkningsdato {virkningsdato}
          </p>
        </div>
        <Link
          to={`/admin/person/${task.personId}?fra=medlemskap`}
          className="text-xs font-bold text-indigo-500 whitespace-nowrap"
        >
          Personkort ↗
        </Link>
      </div>

      <ol className="space-y-3">
        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--studio-row)] border border-[var(--studio-border)] text-[10px] font-black flex items-center justify-center">
            1
          </span>
          <label className="flex items-center gap-2 text-sm pt-0.5">
            <input
              type="checkbox"
              checked={step1Done}
              disabled={busy}
              onChange={(e) => setCornerstone(e.target.checked)}
            />
            Registrert i Cornerstone
          </label>
        </li>

        <li className="flex gap-3 items-start">
          <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--studio-row)] border border-[var(--studio-border)] text-[10px] font-black flex items-center justify-center">
            2
          </span>
          <div className="flex-1 min-w-0 space-y-2">
            {task.kind === "withdrawal" && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || DEMO !== null || !canSendWithdrawalAttestationEmail(task, personEmail).ok}
                  onClick={emailAttestation}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  Send attest på e-post
                </button>
                <button
                  type="button"
                  onClick={downloadAttest}
                  className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold"
                >
                  Last ned .docx for brevpost
                </button>
              </div>
            )}
            {task.kind === "correctEnrollmentDate" && (
              <label className="flex flex-col gap-1 text-xs max-w-xs">
                <span className="font-bold text-[var(--studio-muted)]">Riktig innmeldingsdato</span>
                <input type="date" value={correctedDate} onChange={(e) => setCorrectedDate(e.target.value)} className={inputClass} />
              </label>
            )}
            {task.kind === "application" && application && (
              <div className="space-y-2">
                <Link to={membershipApplicationAdminPath(application.id)} className="text-xs font-bold text-indigo-500">
                  Åpne skjema i arkivet
                </Link>
                {application.kind === "denominationGToA" && (
                  <p className="text-xs text-[var(--studio-muted)]">
                    G→A fullføres på arkivsiden med utmeldings- og innmeldingsdato.
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={task.applicationArchiveConfirmed === true}
                    disabled={busy}
                    onChange={(e) => patchTask({ applicationArchiveConfirmed: e.target.checked })}
                  />
                  Signert skjema ligger i arkivet
                </label>
              </div>
            )}
          </div>
        </li>
      </ol>

      <button
        type="button"
        onClick={() => setNoteOpen((v) => !v)}
        className="text-xs font-bold text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
      >
        {noteOpen ? "Skjul notat" : "+ Legg til notat"}
      </button>
      {noteOpen && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className={`${inputClass} w-full`}
          />
          <button type="button" disabled={busy} onClick={saveComment} className="text-xs font-bold text-indigo-500">
            Lagre notat
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={busy || !canFinish}
        onClick={finish}
        className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40"
      >
        Merk som utført og gå til neste
      </button>
    </div>
  );
};