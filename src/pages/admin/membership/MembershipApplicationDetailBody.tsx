import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { MembershipApplication } from "../../../types";
import { membershipApplicationKindLabel } from "../../../utils/membershipApplication";
import { applicantLabel, membershipWorkflowSteps } from "../../../utils/membershipClerkWorkflow";
import { G_TO_A_CLERK_PROCEDURE } from "../../../utils/denominationGToA";
import { formatBirthDate } from "../../../utils/birthDate";

const DETAIL_ROW = "text-xs text-[var(--studio-muted)]";
const DETAIL_VAL = "text-sm text-[var(--studio-text)]";

export const MembershipApplicationDetailBody: React.FC<{
  app: MembershipApplication;
  busy: boolean;
  onReceive: () => void;
  onCornerstone: () => void;
  onComplete: (reference?: { transitionGEndedAt?: string; transitionAStartedAt?: string }) => void;
  onDismiss: () => void;
}> = ({ app, busy, onReceive, onCornerstone, onComplete, onDismiss }) => {
  const steps = membershipWorkflowSteps(app);
  const canReceive = app.status === "submitted";
  const canCornerstone = app.status === "received";
  const canComplete = app.status === "cornerstoneDone";
  const [transitionGEndedAt, setTransitionGEndedAt] = useState("");
  const [transitionAStartedAt, setTransitionAStartedAt] = useState("");

  return (
    <section className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-lg font-black text-[var(--studio-text)]">{app.applicantName || applicantLabel(app)}</p>
          <p className="text-sm text-[var(--studio-muted)]">{membershipApplicationKindLabel[app.kind]}</p>
        </div>
        <Link
          to={`/admin/person/${app.personId}`}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
        >
          Åpne person i registeret
        </Link>
      </div>

      {app.kind === "denominationGToA" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-950">Prosedyre G → A</p>
          <ol className="list-decimal list-inside text-xs text-[var(--studio-muted)] space-y-1">
            {G_TO_A_CLERK_PROCEDURE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-2 text-sm ${step.done ? "text-emerald-400" : "text-[var(--studio-muted)]"}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step.done ? "bg-emerald-600 text-white" : "border border-[var(--studio-border)]"
              }`}
            >
              {step.done ? "✓" : "·"}
            </span>
            <span className="font-semibold">{step.label}</span>
            {step.at && <span className="text-xs text-[var(--studio-muted)]">{formatBirthDate(step.at.slice(0, 10))}</span>}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {canReceive && (
          <button
            type="button"
            disabled={busy}
            onClick={onReceive}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Merk som mottatt
          </button>
        )}
        {canCornerstone && (
          <button
            type="button"
            disabled={busy}
            onClick={onCornerstone}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Ført inn i Cornerstone
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (app.kind === "denominationGToA" && (!transitionGEndedAt || !transitionAStartedAt)) return;
              onComplete(
                app.kind === "denominationGToA"
                  ? { transitionGEndedAt, transitionAStartedAt }
                  : undefined
              );
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Bekreftet i Menighetsplan
          </button>
        )}
        {app.status !== "completed" && app.status !== "dismissed" && (
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="px-4 py-2 rounded-xl border border-[var(--studio-border)] text-[var(--studio-muted)] text-xs font-bold"
          >
            Avvis
          </button>
        )}
      </div>

      {canComplete && app.kind === "denominationGToA" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs space-y-1">
            <span className="font-bold text-[var(--studio-muted)]">Utmeldingsdato G (logg)</span>
            <input
              type="date"
              value={transitionGEndedAt}
              onChange={(e) => setTransitionGEndedAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--studio-border)] px-2 py-1.5 text-sm bg-[var(--studio-bg)]"
            />
          </label>
          <label className="text-xs space-y-1">
            <span className="font-bold text-[var(--studio-muted)]">Innmeldingsdato A (logg)</span>
            <input
              type="date"
              value={transitionAStartedAt}
              onChange={(e) => setTransitionAStartedAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--studio-border)] px-2 py-1.5 text-sm bg-[var(--studio-bg)]"
            />
          </label>
        </div>
      )}

      {canComplete && app.kind !== "denominationGToA" && (
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Før du bekrefter: oppdater medlemskap på personkortet i registeret (menighet og/eller trossamfunn), slik det
          samsvarer med skjemaet og det du har ført i Cornerstone.
        </p>
      )}
      {canComplete && app.kind === "denominationGToA" && (
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Ved bekreftelse oppdateres personkortet: type A, utmeldingsdato G og innmeldingsdato A.
        </p>
      )}

      {app.status === "completed" && (app.transitionGEndedAt || app.completedAt) && (
        <p className="text-xs text-[var(--studio-muted)]">
          {app.transitionGEndedAt && (
            <>
              G utmeldt {formatBirthDate(app.transitionGEndedAt)}
              {app.transitionAStartedAt ? ` · A innmeldt ${formatBirthDate(app.transitionAStartedAt)}` : ""}
              {" · "}
            </>
          )}
          Fullført{" "}
          {app.completedAt ? formatBirthDate(app.completedAt.slice(0, 10)) : ""}
          {app.completedBy ? ` av ${app.completedBy}` : ""}
        </p>
      )}

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--studio-border)] pt-4">
        <Detail label="Navn" value={`${app.firstNames} ${app.lastName}`.trim()} />
        <Detail label="Adresse" value={app.address} />
        <Detail label="Telefon" value={app.phone} />
        <Detail label="E-post" value={app.email} />
        {app.congregationName && <Detail label="Menighet" value={app.congregationName} />}
        {app.alsoDenomination && <Detail label="Også trossamfunn" value="Ja" />}
        {app.childrenToEnroll && <Detail label="Barn skal meldes inn" value="Ja" />}
        {app.childFirstNames && (
          <Detail label="Barn" value={`${app.childFirstNames} ${app.childLastName ?? ""}`.trim()} />
        )}
        <Detail label="Signatur sted/dato" value={`${app.signaturePlace}, ${app.signatureDate}`} />
      </dl>
    </section>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) =>
  value ? (
    <div>
      <dt className={DETAIL_ROW}>{label}</dt>
      <dd className={DETAIL_VAL}>{value}</dd>
    </div>
  ) : null;