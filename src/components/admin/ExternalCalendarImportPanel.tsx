import React, { useState } from "react";
import { formatNorwegianDateTime } from "../../hooks/useAppHooks";
import { RefreshCw, Plus, X, Trash2, Check, ListChecks, RotateCcw } from "lucide-react";
import { useExternalCalendarQueue } from "../../hooks/useExternalCalendarQueue";
import type { ExternalCalendarEvent } from "../../utils/externalCalendar";
import type { ShowFeedback, StudioData } from "../../pages/admin/studio";
import { NewGatheringDialog } from "../../pages/admin/NewGatheringDialog";
import { DeleteGatheringDialog, type StaffedTask } from "../../pages/admin/DeleteGatheringDialog";
import { useFirebase } from "../../context/FirebaseDataContext";
import type { AdminGatheringItem } from "../../hooks/useAppHooks";
import { useGatheringTemplates } from "../../hooks/useGatheringTemplates";
import { studioCard } from "../../pages/admin/studioTheme";
import { ConfirmDialog } from "../ConfirmDialog";

interface ExternalCalendarImportPanelProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

export const ExternalCalendarImportPanel: React.FC<ExternalCalendarImportPanelProps> = ({ studio, showFeedback }) => {
  const queue = useExternalCalendarQueue(studio, showFeedback);
  const { templates } = useGatheringTemplates();
  const { assignments, getPersonById, deleteGatheringWithStaffing } = useFirebase();
  const [moreOptions, setMoreOptions] = useState<ExternalCalendarEvent | null>(null);
  const [deleting, setDeleting] = useState<AdminGatheringItem | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const staffedTasksOf = (item: AdminGatheringItem): StaffedTask[] =>
    item.tasks.flatMap((task) => {
      const people = assignments
        .filter((assignment) => assignment.taskId === task.id && (assignment.response === "confirmed" || assignment.response === "pending"))
        .map((assignment) => ({
          name: getPersonById(assignment.personId)?.name ?? assignment.personName ?? "Ukjent person",
          asked: assignment.response === "pending",
        }));
      return people.length > 0 ? [{ title: task.title, people }] : [];
    });

  const confirmDelete = (item: AdminGatheringItem) => {
    const res = deleteGatheringWithStaffing(item.gathering.id);
    setDeleting(null);
    if (res.success) {
      showFeedback("Arrangementet ble slettet");
      void queue.sync();
    } else showFeedback(res.error || "Kunne ikke slette arrangementet", "error");
  };

  const requestDelete = (item: AdminGatheringItem) => {
    if (staffedTasksOf(item).length > 0) setDeleting(item);
    else confirmDelete(item);
  };

  const dismissKey = (event: ExternalCalendarEvent) => event.uid || `${event.startsAt}|${event.title}`;

  const resetImportActions = (
    <button
      type="button"
      onClick={() => setConfirmReset(true)}
      disabled={queue.syncing || queue.resetWorking || queue.batchWorking}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-800/80 text-xs font-bold text-red-200 hover:bg-red-950 hover:text-red-400"
    >
      <RotateCcw className={`w-3.5 h-3.5 ${queue.resetWorking ? "animate-spin" : ""}`} aria-hidden="true" />
      Start import på nytt
    </button>
  );

  if (!queue.importOn) return null;

  if (!queue.diff) {
    return (
      <>
        <div className={`${studioCard} p-4 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-xs text-[var(--studio-muted)]">Henter kirkens kalender …</p>
          {resetImportActions}
        </div>
        {confirmReset && (
          <ConfirmDialog
            title="Start kalenderimport på nytt?"
            tone="danger"
            confirmLabel="Ja, nullstill import"
            busy={queue.resetWorking}
            onCancel={() => setConfirmReset(false)}
            onConfirm={() => {
              void queue.resetImport(deleteGatheringWithStaffing).then(() => setConfirmReset(false));
            }}
          >
            <p>
              Alle arrangementer som er knyttet til kirkens kalender fjernes, sammen med sannsynlige duplikater (samme
              tittel og dag som i feeden). Valg i importkøen («Ikke nå» og «Behold») nullstilles. Deretter hentes
              feeden på nytt
              {queue.importNewAutomatically ? " og nye rader opprettes automatisk." : "."}
            </p>
          </ConfirmDialog>
        )}
      </>
    );
  }

  const { newEvents, gone } = queue.diff;
  if (newEvents.length === 0 && gone.length === 0) {
    return (
      <>
        <div className={`${studioCard} p-4 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-xs text-[var(--studio-muted)]">Kirkens kalender er synkronisert. Ingen nye rader i køen.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void queue.sync({ runImport: queue.importNewAutomatically })}
              disabled={queue.syncing}
              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-indigo-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${queue.syncing ? "animate-spin" : ""}`} aria-hidden="true" />
              Oppdater fra kirkens kalender
            </button>
            {resetImportActions}
          </div>
        </div>
        {confirmReset && (
          <ConfirmDialog
            title="Start kalenderimport på nytt?"
            tone="danger"
            confirmLabel="Ja, nullstill import"
            busy={queue.resetWorking}
            onCancel={() => setConfirmReset(false)}
            onConfirm={() => {
              void queue.resetImport(deleteGatheringWithStaffing).then(() => setConfirmReset(false));
            }}
          >
            <p>
              {queue.importResetCandidateCount > 0 ? (
                <>
                  Ca. <span className="font-bold text-[var(--studio-text)]">{queue.importResetCandidateCount}</span>{" "}
                  arrangementer i planleggeren matcher importen og fjernes.
                </>
              ) : (
                <>Ingen importerte arrangementer er funnet ut fra siste feed — importkøen nullstilles likevel.</>
              )}{" "}
              Deretter hentes kirkens kalender på nytt
              {queue.importNewAutomatically ? " og nye rader opprettes automatisk." : ", og du kan opprette på nytt fra køen."}
            </p>
          </ConfirmDialog>
        )}
      </>
    );
  }

  return (
    <section className={`${studioCard} p-4 sm:p-5 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[var(--studio-text)]">Fra kirkens kalender</h3>
          <p className="text-xs text-[var(--studio-muted)] mt-1">
            Hendelser i feeden som ikke er knyttet til planleggeren ennå, eller som er borte fra feeden.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void queue.sync({ runImport: queue.importNewAutomatically })}
          disabled={queue.syncing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${queue.syncing ? "animate-spin" : ""}`} aria-hidden="true" />
          Oppdater
        </button>
        {resetImportActions}
      </div>

      {newEvents.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)]">
            {queue.importNewAutomatically ? (
              <p className="text-xs text-[var(--studio-muted)] max-w-lg">
                <span className="font-bold text-[var(--studio-text)]">Opprett nye automatisk</span> er på (Database → Flater).
                Nye rader opprettes ved oppdatering — ikke bruk «Opprett» i tillegg. «Flere valg» er for unntak.
              </p>
            ) : (
              <>
                <p className="text-xs text-[var(--studio-muted)] max-w-md">
                  Gå gjennom lista og trykk <span className="font-bold text-[var(--studio-text)]">Opprett alle</span>, eller opprett én og én.
                  Automatisk oppretting slår du på under Database → Flater.
                </p>
                <button
                  type="button"
                  disabled={!queue.groupReady || queue.batchWorking || queue.syncing}
                  onClick={() => void queue.createAllNew()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shrink-0"
                >
                  <ListChecks className="w-4 h-4" aria-hidden="true" />
                  Opprett alle ({newEvents.length})
                </button>
              </>
            )}
          </div>
        <ul className="space-y-2">
          {newEvents.map((event) => {
            const uid = event.uid || event.startsAt;
            return (
              <li key={uid} className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--studio-text)] truncate">{event.title}</p>
                  <p className="text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(event.startsAt)}</p>
                  {event.location && <p className="text-xs text-[var(--studio-muted)]">{event.location}</p>}
                </div>
                <label className="text-xs text-[var(--studio-muted)] flex items-center gap-2">
                  <span className="shrink-0">Mal</span>
                  <select
                    value={queue.templateIdFor(event) ?? ""}
                    onChange={(e) => queue.setTemplateFor(event, e.target.value)}
                    className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 py-1 text-[var(--studio-text)]"
                  >
                    <option value="">Uten mal</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {!queue.importNewAutomatically && (
                  <button
                    type="button"
                    disabled={!queue.groupReady}
                    onClick={() => queue.createFromEvent(event, queue.templateIdFor(event) ?? null)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Opprett
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMoreOptions(event)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)]"
                  >
                    Flere valg
                  </button>
                  <button
                    type="button"
                    onClick={() => void queue.dismiss(dismissKey(event))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--studio-muted)]"
                  >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      Ikke nå
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      {gone.length > 0 && (
        <ul className="space-y-2 pt-2 border-t border-[var(--studio-border)]">
          <p className="text-xs font-bold text-amber-300">Finnes ikke lenger i kirkens kalender</p>
          {gone.map((gathering) => {
            const item = studio.adminGatherings.find((entry) => entry.gathering.id === gathering.id);
            if (!item) return null;
            return (
              <li key={gathering.id} className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--studio-text)]">{gathering.title}</p>
                  <p className="text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(gathering.startsAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => item && requestDelete(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/60 text-red-200 text-xs font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Slett
                  </button>
                  {gathering.externalCalendarUid && (
                    <button
                      type="button"
                      onClick={() => void queue.keep(gathering.externalCalendarUid!)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      Behold
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {moreOptions && (
        <NewGatheringDialog
          studio={studio}
          showFeedback={showFeedback}
          initial={queue.formInitialFor(moreOptions)}
          initialTemplateId={queue.templateIdFor(moreOptions)}
          externalCalendarUid={moreOptions.uid || undefined}
          onCreated={(gathering) => {
            setMoreOptions(null);
            queue.afterFormCreate(gathering);
          }}
          onClose={() => setMoreOptions(null)}
        />
      )}

      {deleting && (
        <DeleteGatheringDialog
          title={deleting.gathering.title}
          when={formatNorwegianDateTime(deleting.gathering.startsAt)}
          staffed={staffedTasksOf(deleting)}
          onConfirm={() => confirmDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Start kalenderimport på nytt?"
          tone="danger"
          confirmLabel="Ja, nullstill import"
          busy={queue.resetWorking}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            void queue.resetImport(deleteGatheringWithStaffing).then(() => setConfirmReset(false));
          }}
        >
          <p>
            {queue.importResetCandidateCount > 0 ? (
              <>
                Ca. <span className="font-bold text-[var(--studio-text)]">{queue.importResetCandidateCount}</span>{" "}
                arrangementer i planleggeren fjernes (importerte rader og sannsynlige duplikater).
              </>
            ) : (
              <>Importerte arrangementer fjernes ut fra siste feed, og importkøen nullstilles.</>
            )}{" "}
            Oppgaver og tildelinger på disse arrangementene slettes også. Deretter hentes kirkens kalender på nytt
            {queue.importNewAutomatically ? " og nye rader opprettes automatisk." : "."}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
};
