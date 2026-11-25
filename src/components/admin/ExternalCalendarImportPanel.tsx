import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatNorwegianDateTime } from "../../hooks/useAppHooks";
import { RefreshCw, Plus, X, Trash2, Check, ListChecks, RotateCcw } from "lucide-react";
import { useExternalCalendarQueue } from "../../hooks/useExternalCalendarQueue";
import {
  bestLink,
  differingFields,
  dismissedFeedRows,
  linkCandidates,
  linkedFeedRows,
  type CalendarField,
  type ExternalCalendarEvent,
} from "../../utils/externalCalendar";
import { parseIsoToDateAndTime } from "../../utils/dates";
import type { ShowFeedback, StudioData } from "../../pages/admin/studio";
import { NewGatheringDialog } from "../../pages/admin/NewGatheringDialog";
import { DeleteGatheringDialog, type StaffedTask } from "../../pages/admin/DeleteGatheringDialog";
import { useFirebase } from "../../context/FirebaseDataContext";
import type { AdminGatheringItem } from "../../hooks/useAppHooks";
import { useGatheringTemplates } from "../../hooks/useGatheringTemplates";
import { studioCard } from "../../pages/admin/studioTheme";
import { ConfirmDialog } from "../ConfirmDialog";
import { rememberDeletedCalendarEvent } from "../gathering/useGatheringDeletion";
import type { Gathering } from "../../types";

interface ExternalCalendarImportPanelProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

type ImportTab = "venter" | "lagt-inn" | "endret" | "avvist";

/** A feed row and the planner event it is suggested to be, chosen by the admin. */
interface LinkPair {
  event: ExternalCalendarEvent;
  gatheringId: string;
  checked: boolean;
}

/** A linked event whose Google values differ from the app's, with the fields that differ. */
interface ChangeRow {
  gathering: Gathering;
  event: ExternalCalendarEvent;
  fields: CalendarField[];
  checked: boolean;
}

/** The time of a moment alone when it is on the same day as the other one, else the whole date and time. */
function timeText(iso: string, other: string): string {
  const a = parseIsoToDateAndTime(iso);
  const b = parseIsoToDateAndTime(other);
  return a.date === b.date ? a.time : formatNorwegianDateTime(iso);
}

/** What differs, as the admin reads it: Google's value first, then the app's. */
function changeLines(gathering: Gathering, event: ExternalCalendarEvent, fields: readonly CalendarField[]): string[] {
  return fields.map((field) => {
    if (field === "title") return `Tittel: Google «${event.title}» · appen «${gathering.title}»`;
    if (field === "startsAt") return `Tid: Google ${timeText(event.startsAt, gathering.startsAt)} · appen ${timeText(gathering.startsAt, event.startsAt)}`;
    if (field === "location") return `Sted: Google «${event.location || "tomt"}» · appen «${gathering.location || "tomt"}»`;
    return event.cancelled ? "Avlyst i kirkens kalender" : "Ikke avlyst i kirkens kalender";
  });
}

const TABS: { id: ImportTab; label: string }[] = [
  { id: "venter", label: "Venter" },
  { id: "lagt-inn", label: "Lagt inn" },
  { id: "endret", label: "Endret" },
  { id: "avvist", label: "Avvist og slettet" },
];

const dismissKey = (event: ExternalCalendarEvent) => event.uid || `${event.startsAt}|${event.title}`;

export const ExternalCalendarImportPanel: React.FC<ExternalCalendarImportPanelProps> = ({ studio, showFeedback }) => {
  const queue = useExternalCalendarQueue(studio, showFeedback);
  const { templates } = useGatheringTemplates();
  const { assignments, getPersonById, deleteGatheringWithStaffing } = useFirebase();
  const [moreOptions, setMoreOptions] = useState<ExternalCalendarEvent | null>(null);
  const [deleting, setDeleting] = useState<AdminGatheringItem | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tab, setTab] = useState<ImportTab>("venter");
  const [chosenByKey, setChosenByKey] = useState<Record<string, string>>({});
  const [review, setReview] = useState<LinkPair[] | null>(null);
  const [changeReview, setChangeReview] = useState<ChangeRow[] | null>(null);

  const gatherings: Gathering[] = studio.adminGatherings.map((item) => item.gathering);

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
      rememberDeletedCalendarEvent(item.gathering);
      showFeedback("Arrangementet ble slettet");
      void queue.sync();
    } else showFeedback(res.error || "Kunne ikke slette arrangementet", "error");
  };

  const requestDelete = (item: AdminGatheringItem) => {
    if (staffedTasksOf(item).length > 0) setDeleting(item);
    else confirmDelete(item);
  };

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

  const resetDialog = confirmReset ? (
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
  ) : null;

  if (!queue.importOn) return null;

  if (!queue.diff) {
    return (
      <>
        <div className={`${studioCard} p-4 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-xs text-[var(--studio-muted)]">Henter kirkens kalender …</p>
          {resetImportActions}
        </div>
        {resetDialog}
      </>
    );
  }

  const { newEvents, gone, updated } = queue.diff;
  const linked = linkedFeedRows(queue.feed, gatherings);
  const dismissed = dismissedFeedRows(queue.feed, queue.dismissedUids, queue.noteFor);
  const venterCount = newEvents.length + gone.length;
  const counts: Record<ImportTab, number> = {
    venter: venterCount,
    "lagt-inn": linked.length,
    endret: updated.length,
    avvist: dismissed.length,
  };

  // Each feed row that has a clear suggestion, and at most one feed row per planner event
  const suggestedPairs: LinkPair[] = [];
  const takenIds = new Set<string>();
  for (const event of newEvents) {
    const best = event.uid ? bestLink(event, gatherings) : null;
    if (!best || takenIds.has(best.id)) continue;
    takenIds.add(best.id);
    suggestedPairs.push({ event, gatheringId: best.id, checked: true });
  }

  const whenOf = (g: Gathering) => formatNorwegianDateTime(g.startsAt);

  const startReview = () => setReview(suggestedPairs);

  const confirmReview = () => {
    if (!review) return;
    queue.linkAll(review.filter((pair) => pair.checked).map(({ event, gatheringId }) => ({ event, gatheringId })));
    setReview(null);
  };

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-black text-[var(--studio-text)]">Fra kirkens kalender</h3>
        <p className="text-xs text-[var(--studio-muted)] mt-1">
          Hendelser i feeden som ikke er knyttet til planleggeren ennå, eller som er borte fra feeden.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );

  const tabBar = (
    <div role="tablist" aria-label="Kirkens kalender" className="flex flex-wrap gap-1 border-b border-[var(--studio-border)]">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          onClick={() => setTab(item.id)}
          className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px ${
            tab === item.id ? "border-indigo-500 text-[var(--studio-text)]" : "border-transparent text-[var(--studio-muted)]"
          }`}
        >
          {`${item.label} (${counts[item.id]})`}
        </button>
      ))}
    </div>
  );

  const venter = (
    <>
      {suggestedPairs.length > 0 && !review && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)]">
          <p className="text-xs text-[var(--studio-muted)] max-w-md">
            Noen hendelser ligner tydelig på arrangementer dere allerede har. Koble dem, så legges de ikke inn på nytt.
          </p>
          <button
            type="button"
            onClick={startReview}
            disabled={queue.syncing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)] shrink-0"
          >
            Koble alle forslag ({suggestedPairs.length})
          </button>
        </div>
      )}

      {review && (
        <section aria-label="Koble alle forslag" className="p-3 rounded-xl bg-[var(--studio-bg)] border border-indigo-700/60 space-y-3">
          <p className="text-sm font-bold text-[var(--studio-text)]">Koble alle forslag</p>
          <p className="text-xs text-[var(--studio-muted)]">Koblingen endrer bare hvilken hendelse i kalenderen arrangementet hører til.</p>
          <ul className="space-y-2">
            {review.map((pair, index) => {
              const target = gatherings.find((g) => g.id === pair.gatheringId);
              return (
                <li key={`${pair.event.uid}-${pair.gatheringId}`}>
                  <label className="flex items-start gap-2 text-xs text-[var(--studio-text)]">
                    <input
                      type="checkbox"
                      checked={pair.checked}
                      onChange={(e) =>
                        setReview((prev) => prev?.map((row, i) => (i === index ? { ...row, checked: e.target.checked } : row)) ?? null)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      «{pair.event.title} {formatNorwegianDateTime(pair.event.startsAt)}» → «{target?.title ?? ""}{" "}
                      {target ? whenOf(target) : ""}»
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmReview}
              disabled={!review.some((pair) => pair.checked)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Koble valgte ({review.filter((pair) => pair.checked).length})
            </button>
            <button
              type="button"
              onClick={() => setReview(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--studio-muted)]"
            >
              Avbryt
            </button>
          </div>
        </section>
      )}

      {newEvents.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)]">
            {queue.importNewAutomatically ? (
              <p className="text-xs text-[var(--studio-muted)] max-w-lg">
                <span className="font-bold text-[var(--studio-text)]">Opprett nye automatisk</span> er på (Database → Flater).
                Nye rader opprettes ved oppdatering — ikke bruk «Importer» i tillegg. «Flere valg» er for unntak.
              </p>
            ) : (
              <>
                <p className="text-xs text-[var(--studio-muted)] max-w-md">
                  Gå gjennom lista og trykk <span className="font-bold text-[var(--studio-text)]">Opprett alle</span>, eller importer én og én.
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
              const key = dismissKey(event);
              const candidates = linkCandidates(event, gatherings);
              const chosenId = chosenByKey[key] ?? bestLink(event, gatherings)?.id ?? candidates[0]?.id ?? "";
              const chosen = candidates.find((g) => g.id === chosenId) ?? candidates[0];
              return (
                <li key={key} className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--studio-text)] truncate">{event.title}</p>
                    <p className="text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(event.startsAt)}</p>
                    {event.location && <p className="text-xs text-[var(--studio-muted)]">{event.location}</p>}
                    {candidates.length === 1 && (
                      <p className="text-xs text-indigo-200 mt-1">
                        Ligner på: {candidates[0].title} {whenOf(candidates[0])}
                      </p>
                    )}
                    {candidates.length > 1 && <p className="text-xs text-indigo-200 mt-1">Ligner på flere arrangementer.</p>}
                  </div>
                  {candidates.length > 1 && (
                    <label className="text-xs text-[var(--studio-muted)] flex items-center gap-2">
                      <span className="shrink-0">Velg arrangement</span>
                      <select
                        value={chosen?.id ?? ""}
                        onChange={(e) => setChosenByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 py-1 text-[var(--studio-text)]"
                      >
                        {candidates.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title} {whenOf(g)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
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
                    {chosen && (
                      <button
                        type="button"
                        onClick={() => queue.linkEvent(event, chosen.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-600 text-indigo-200 text-xs font-bold"
                      >
                        Koble
                      </button>
                    )}
                    {!queue.importNewAutomatically && (
                      <button
                        type="button"
                        disabled={!queue.groupReady}
                        onClick={() => queue.createFromEvent(event, queue.templateIdFor(event) ?? null)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        Importer
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
                      onClick={() => void queue.dismiss(event)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--studio-muted)]"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      Avvis
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

      {newEvents.length === 0 && gone.length === 0 && (
        <p className="text-xs text-[var(--studio-muted)]">Kirkens kalender er synkronisert. Ingen nye rader i køen.</p>
      )}
    </>
  );

  const lagtInn = (
    <>
      {linked.length === 0 && <p className="text-xs text-[var(--studio-muted)]">Ingen hendelser fra kalenderen er knyttet til arrangementer ennå.</p>}
      <ul className="space-y-2">
        {linked.map(({ event, gathering }) => (
          <li key={gathering.id} className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--studio-text)] truncate">{event.title}</p>
              <p className="text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(event.startsAt)}</p>
            </div>
            <Link to={`/admin/samling/${gathering.id}`} className="text-xs font-bold text-indigo-300">
              Åpne
            </Link>
          </li>
        ))}
      </ul>
    </>
  );

  const endret = (
    <>
      <p className="text-xs text-[var(--studio-muted)]">
        Endringer i kirkens kalender er forslag. Appen endrer aldri et arrangement av seg selv.
      </p>
      {updated.length === 0 && <p className="text-xs text-[var(--studio-muted)]">Ingen arrangementer har endret seg i kalenderen.</p>}
      {updated.length > 0 && !changeReview && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)]">
          <p className="text-xs text-[var(--studio-muted)] max-w-md">Velg hva som skal tas inn. Det du lar være, står som før i appen.</p>
          <button
            type="button"
            onClick={() =>
              setChangeReview(
                updated.map(({ gathering, event }) => ({ gathering, event, fields: differingFields(gathering, event), checked: true }))
              )
            }
            disabled={queue.syncing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)] shrink-0"
          >
            Oppdater alle ({updated.length})
          </button>
        </div>
      )}

      {changeReview && (
        <section aria-label="Oppdater alle" className="p-3 rounded-xl bg-[var(--studio-bg)] border border-indigo-700/60 space-y-3">
          <p className="text-sm font-bold text-[var(--studio-text)]">Oppdater alle</p>
          <p className="text-xs text-[var(--studio-muted)]">Bare feltene som er avkrysset blir hentet inn. Resten av arrangementet røres ikke.</p>
          <ul className="space-y-2">
            {changeReview.map((row, index) => (
              <li key={row.gathering.id}>
                <label className="flex items-start gap-2 text-xs text-[var(--studio-text)]">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) =>
                      setChangeReview((prev) => prev?.map((item, i) => (i === index ? { ...item, checked: e.target.checked } : item)) ?? null)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-bold">{row.gathering.title}</span> {whenOf(row.gathering)}:{" "}
                    {changeLines(row.gathering, row.event, row.fields).join("; ")}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!changeReview.some((row) => row.checked)}
              onClick={() => {
                queue.applyCalendarChanges(
                  changeReview
                    .filter((row) => row.checked)
                    .map(({ gathering, event, fields }) => ({ gathering, event, fields }))
                );
                setChangeReview(null);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Oppdater valgte ({changeReview.filter((row) => row.checked).length})
            </button>
            <button type="button" onClick={() => setChangeReview(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--studio-muted)]">
              Avbryt
            </button>
          </div>
        </section>
      )}

      <ul className="space-y-2">
        {updated.map(({ gathering, event }) => {
          const fields = differingFields(gathering, event);
          const cancelChange = fields.includes("cancelled") && event.cancelled;
          const lines = changeLines(gathering, event, fields).filter((line) => !(cancelChange && line.startsWith("Avlyst")));
          return (
            <li key={gathering.id} className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-[var(--studio-text)] truncate">
                  {gathering.title} <span className="text-xs font-normal text-[var(--studio-muted)]">{whenOf(gathering)}</span>
                </p>
                {cancelChange && <p className="text-xs font-bold text-amber-300">Avlyst i kirkens kalender</p>}
                {lines.map((line) => (
                  <p key={line} className="text-xs text-[var(--studio-muted)]">
                    {line}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => queue.applyCalendarChanges([{ gathering, event, fields }])}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                >
                  Oppdater
                </button>
                {cancelChange && (
                  <button
                    type="button"
                    onClick={() => queue.applyCalendarChanges([{ gathering, event, fields: ["cancelled"] }])}
                    className="px-3 py-1.5 rounded-lg border border-amber-700 text-amber-200 text-xs font-bold"
                  >
                    Avlys her også
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void queue.declineChanges(event)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)]"
                >
                  La være
                </button>
                <Link to={`/admin/samling/${gathering.id}`} className="px-3 py-1.5 text-xs font-bold text-indigo-300">
                  Åpne
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  const avvist = (
    <>
      {dismissed.length === 0 && <p className="text-xs text-[var(--studio-muted)]">Ingen avviste eller slettede hendelser.</p>}
      <ul className="space-y-2">
        {dismissed.map((row) => (
          <li key={row.uid} className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--studio-text)] truncate">{row.title}</p>
              {row.startsAt && <p className="text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(row.startsAt)}</p>}
              <p className="text-xs text-[var(--studio-muted)]">
                {row.note
                  ? `${row.note.reason === "slettet" ? "Slettet" : "Avvist"} ${formatNorwegianDateTime(row.note.at)}`
                  : "Avvist"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void queue.restore(row.uid)}
              className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-bold text-[var(--studio-text)]"
            >
              Ta inn likevel
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  const panels: Record<ImportTab, React.ReactNode> = {
    venter,
    "lagt-inn": lagtInn,
    endret,
    avvist,
  };

  return (
    <section className={`${studioCard} p-4 sm:p-5 space-y-4`}>
      {header}
      {tabBar}
      <div role="tabpanel" className="space-y-4">
        {panels[tab]}
      </div>

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
          fromCalendar={Boolean(deleting.gathering.externalCalendarUid)}
          onConfirm={() => confirmDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      {resetDialog}
    </section>
  );
};
