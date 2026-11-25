import { useCallback, useEffect, useRef, useState } from "react";
import { useCms } from "../context/CmsContext";
import {
  dismissExternalEvent,
  dismissExternalUid,
  declineExternalChange,
  keepExternalUid,
  restoreExternalUid,
} from "../services/surfaces";
import { reportWriteError } from "../services/writeErrors";
import {
  calendarPatch,
  declinedValuesOf,
  diffCalendar,
  formValuesFromExternalEvent,
  parseExternalCalendarFeed,
  proposeImport,
  type CalendarDiff,
  type CalendarField,
  type ExternalCalendarEvent,
} from "../utils/externalCalendar";
import {
  calendarDeclinedFor,
  calendarNoteFor,
  calendarNoteKey,
  icalImportOn,
  type CalendarDeclined,
  type CalendarNote,
  type InstallationSurfaces,
} from "../utils/surfaces";
import { formatNorwegianDateTime } from "../utils/dates";
import { useGatheringTemplates } from "./useGatheringTemplates";
import { defaultGroupId, type GatheringFormValues } from "../utils/gatheringForm";
import {
  createPlannedGathering,
  formValuesForTemplateApply,
  formValuesFromTemplate,
  planGathering,
  type GatheringTemplate,
} from "../utils/gatheringTemplates";
import { onDay } from "../utils/gatheringForm";
import { hasPlanner } from "../utils/level";
import { useLevel } from "./useLevel";
import type { Gathering } from "../types";
import type { ShowFeedback, StudioData } from "../pages/admin/studio";

let sharedDiff: CalendarDiff | null = null;
let sharedListeners = new Set<(diff: CalendarDiff | null) => void>();

function setSharedDiff(diff: CalendarDiff | null) {
  sharedDiff = diff;
  sharedListeners.forEach((listener) => listener(diff));
}

function templateChoiceFor(
  event: ExternalCalendarEvent,
  overrides: Record<string, string | "">,
  templates: readonly GatheringTemplate[]
): string | null {
  const key = event.uid || event.startsAt;
  const chosen = overrides[key];
  if (chosen === "") return null;
  if (chosen) return chosen;
  return proposeImport(event, templates).templateId;
}

function alreadyLinked(event: ExternalCalendarEvent, known: readonly Gathering[]): boolean {
  if (event.uid && known.some((g) => g.externalCalendarUid === event.uid)) return true;
  return known.some(
    (g) => g.title === event.title && g.startsAt.slice(0, 16) === event.startsAt.slice(0, 16) && g.externalCalendarUid
  );
}

/** What the queue asks the admin to deal with: new rows, events gone from the feed, and changed rows. */
function pendingCount(diff: CalendarDiff | null): number {
  return (diff?.newEvents.length ?? 0) + (diff?.gone.length ?? 0) + (diff?.updated.length ?? 0);
}

/** Pending rows in the iCal import queue (shared between Kalender-fanen and menyen). */
export function useExternalCalendarQueue(studio: StudioData, showFeedback: ShowFeedback) {
  const { surfaces } = useCms();
  const { templates } = useGatheringTemplates();
  const withPlanner = hasPlanner(useLevel());
  const importOn = icalImportOn(surfaces);
  const gatherings = studio.adminGatherings.map((item) => item.gathering);
  const gatheringsRef = useRef(gatherings);
  gatheringsRef.current = gatherings;

  const [diff, setDiff] = useState<CalendarDiff | null>(sharedDiff);
  const [feedRows, setFeedRows] = useState<ExternalCalendarEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [batchWorking, setBatchWorking] = useState(false);
  const [templateByUid, setTemplateByUid] = useState<Record<string, string | "">>({});
  const lastFeedRef = useRef<ExternalCalendarEvent[]>([]);

  useEffect(() => {
    const listener = (next: CalendarDiff | null) => setDiff(next);
    sharedListeners.add(listener);
    return () => {
      sharedListeners.delete(listener);
    };
  }, []);

  const groupId = defaultGroupId(
    studio.adminGroups.map((item) => item.group),
    gatherings
  );

  const refreshQueue = useCallback(
    (knownGatherings: readonly Gathering[], declined: InstallationSurfaces["calendarDeclined"] = surfaces.calendarDeclined) => {
      const declinedFor = (uid: string) => calendarDeclinedFor({ calendarDeclined: declined }, uid);
      const next = diffCalendar(lastFeedRef.current, knownGatherings, surfaces.dismissedUids, surfaces.keptUids, declinedFor);
      setSharedDiff(next);
      return next;
    },
    [surfaces.calendarDeclined, surfaces.dismissedUids, surfaces.keptUids]
  );

  const createOne = useCallback(
    (event: ExternalCalendarEvent, templateId: string | null, known: readonly Gathering[]): Gathering | null => {
      if (!groupId) return null;
      if (alreadyLinked(event, known)) return null;
      const proposal = proposeImport(event, templates);
      let values = formValuesFromExternalEvent(event, groupId, proposal);
      const template = templateId ? templates.find((t) => t.id === templateId) ?? null : null;
      if (template) {
        values = formValuesForTemplateApply(template, formValuesFromTemplate(template, values));
      }
      const result = createPlannedGathering(
        studio,
        planGathering(onDay(values, values.date), {
          template,
          roles: studio.adminVolunteerRoles,
          withPlanner,
          externalCalendarUid: event.uid || undefined,
        })
      );
      return result.success ? result.gathering ?? null : null;
    },
    [groupId, studio, templates, withPlanner]
  );

  const importNewEvents = useCallback(
    (events: readonly ExternalCalendarEvent[], overrides: Record<string, string | "">) => {
      let known = gatheringsRef.current;
      let created = 0;
      let failed = 0;
      let skipped = 0;
      for (const event of events) {
        if (alreadyLinked(event, known)) {
          skipped++;
          continue;
        }
        const templateId = templateChoiceFor(event, overrides, templates);
        const gathering = createOne(event, templateId, known);
        if (gathering) {
          known = [...known, gathering];
          created++;
        } else failed++;
      }
      gatheringsRef.current = known;
      refreshQueue(known);
      return { created, failed, skipped };
    },
    [createOne, refreshQueue, templates]
  );

  /** Hent feed og oppdater køen. Oppretter bare nye rader når `runImport` er true (batch eller innstilling under Database). Endringer fra kalenderen skrives aldri av seg selv. */
  const syncFeed = useCallback(
    async (
      runImport: boolean,
      queueOverrides?: { dismissedUids?: readonly string[]; keptUids?: readonly string[] }
    ) => {
      if (!importOn) return;
      setSyncing(true);
      try {
        const response = await fetch("/api/kalender-innhold");
        const text = await response.text();
        if (!response.ok) throw new Error(text || `Kalenderen svarte ${response.status}`);
        const feed = parseExternalCalendarFeed(text);
        lastFeedRef.current = feed;
        setFeedRows(feed);

        const dismissedUids = queueOverrides?.dismissedUids ?? surfaces.dismissedUids;
        const keptUids = queueOverrides?.keptUids ?? surfaces.keptUids;

        const known = gatheringsRef.current;
        const declinedFor = (uid: string) => calendarDeclinedFor(surfaces, uid);
        const next = diffCalendar(feed, known, dismissedUids, keptUids, declinedFor);

        const overrides: Record<string, string | ""> = { ...templateByUid };
        for (const event of next.newEvents) {
          const key = event.uid || event.startsAt;
          if (overrides[key] === undefined) {
            overrides[key] = proposeImport(event, templates).templateId ?? "";
          }
        }
        setTemplateByUid(overrides);
        setSharedDiff(next);

        const shouldImport = runImport && next.newEvents.length > 0 && groupId;
        if (shouldImport) {
          const { created, failed } = importNewEvents(next.newEvents, overrides);
          if (created > 0) {
            showFeedback(
              failed > 0
                ? `${created} arrangementer opprettet fra kirkens kalender. ${failed} feilet.`
                : `${created} arrangementer opprettet fra kirkens kalender.`
            );
          }
        }
      } catch (error) {
        reportWriteError("hente kirkens kalender", error);
        showFeedback(error instanceof Error ? error.message : "Kunne ikke hente kirkens kalender", "error");
      } finally {
        setSyncing(false);
      }
    },
    [
      groupId,
      importNewEvents,
      importOn,
      showFeedback,
      surfaces,
      surfaces.dismissedUids,
      surfaces.importNewAutomatically,
      surfaces.keptUids,
      templateByUid,
      templates,
    ]
  );

  const sync = useCallback(
    (options: { runImport?: boolean } = {}) => {
      const runImport = options.runImport ?? surfaces.importNewAutomatically;
      return syncFeed(runImport);
    },
    [surfaces.importNewAutomatically, syncFeed]
  );

  const createAllNewPublic = useCallback(() => {
    if (!diff?.newEvents.length) return;
    if (!groupId) {
      showFeedback("Opprett en gruppe først", "error");
      return;
    }
    if (surfaces.importNewAutomatically) {
      showFeedback("Slå av «Opprett nye automatisk» under Database → Flater hvis du vil godkjenne manuelt her.", "error");
      return;
    }
    setBatchWorking(true);
    const { created, failed } = importNewEvents(diff.newEvents, templateByUid);
    setBatchWorking(false);
    if (created > 0) {
      showFeedback(
        failed > 0
          ? `${created} arrangementer opprettet fra kirkens kalender. ${failed} feilet — sjekk kalenderen.`
          : `${created} arrangementer opprettet fra kirkens kalender.`
      );
    } else {
      showFeedback("Ingen arrangementer ble opprettet.", "error");
    }
  }, [diff?.newEvents, groupId, importNewEvents, showFeedback, surfaces.importNewAutomatically, templateByUid]);

  useEffect(() => {
    if (importOn) void syncFeed(surfaces.importNewAutomatically);
    else setSharedDiff(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importOn, surfaces.externalCalendarUrl, surfaces.ownWebsite]);

  const pending = pendingCount(diff);

  const createFromEvent = (event: ExternalCalendarEvent, templateId: string | null) => {
    if (!groupId) {
      showFeedback("Opprett en gruppe først", "error");
      return;
    }
    if (surfaces.importNewAutomatically) {
      showFeedback("Slå av automatisk oppretting under Database → Flater, eller bruk «Flere valg» for ett arrangement.", "error");
      return;
    }
    const created = createOne(event, templateId, gatheringsRef.current);
    if (!created) {
      showFeedback("Arrangementet finnes allerede, eller det ble ikke opprettet.", "error");
      return;
    }
    gatheringsRef.current = [...gatheringsRef.current, created];
    showFeedback("Arrangementet er opprettet fra kirkens kalender.");
    refreshQueue(gatheringsRef.current);
  };

  /** After «Flere valg» saved — refresh køen only, never run batch/auto import again. */
  const afterFormCreate = (gathering: Gathering) => {
    gatheringsRef.current = [...gatheringsRef.current, gathering];
    refreshQueue(gatheringsRef.current);
  };

  /** «Avvis»: the row is hidden, and a note is kept so the planner never takes it in again by itself. */
  const dismiss = async (event: ExternalCalendarEvent) => {
    const note: CalendarNote = { reason: "avvist", at: new Date().toISOString(), title: event.title, startsAt: event.startsAt };
    if (event.uid) await dismissExternalEvent(event.uid, note);
    else await dismissExternalUid(`${event.startsAt}|${event.title}`);
    void syncFeed(false, { dismissedUids: [...surfaces.dismissedUids, event.uid || `${event.startsAt}|${event.title}`] });
  };

  /** «Ta inn likevel»: the feed event is no longer dismissed, and it is shown as a new row again. */
  const restore = async (uid: string) => {
    await restoreExternalUid(uid);
    void syncFeed(false, { dismissedUids: surfaces.dismissedUids.filter((item) => item !== uid) });
  };

  const keep = async (uid: string) => {
    await keepExternalUid(uid);
    void syncFeed(false);
  };

  /** Links one feed event to a planner event, by its uid. Nothing else on the planner event changes. */
  const linkEvent = (event: ExternalCalendarEvent, gatheringId: string): boolean => {
    if (!event.uid) {
      showFeedback("Kan ikke kobles: hendelsen mangler ID i kalenderen.", "error");
      return false;
    }
    const result = studio.updateGathering(gatheringId, { externalCalendarUid: event.uid });
    if (!result.success) {
      showFeedback(result.error || "Kunne ikke koble arrangementet", "error");
      return false;
    }
    gatheringsRef.current = gatheringsRef.current.map((g) =>
      g.id === gatheringId ? { ...g, externalCalendarUid: event.uid } : g
    );
    refreshQueue(gatheringsRef.current);
    showFeedback(`Koblet: ${event.title} ${formatNorwegianDateTime(event.startsAt)}.`);
    return true;
  };

  /** «Koble alle forslag»: each pair is linked once; a planner event already taken by another row is left alone. */
  const linkAll = (pairs: readonly { event: ExternalCalendarEvent; gatheringId: string }[]) => {
    const taken = new Set<string>();
    let linked = 0;
    let failed = 0;
    for (const { event, gatheringId } of pairs) {
      if (!event.uid || taken.has(gatheringId)) {
        failed++;
        continue;
      }
      const result = studio.updateGathering(gatheringId, { externalCalendarUid: event.uid });
      if (!result.success) {
        failed++;
        continue;
      }
      taken.add(gatheringId);
      linked++;
      gatheringsRef.current = gatheringsRef.current.map((g) =>
        g.id === gatheringId ? { ...g, externalCalendarUid: event.uid } : g
      );
    }
    refreshQueue(gatheringsRef.current);
    if (linked === 0 && failed === 0) return { linked, failed };
    showFeedback(
      failed > 0 ? `${linked} arrangementer koblet. ${failed} kunne ikke kobles.` : `${linked} arrangementer koblet.`,
      linked === 0 ? "error" : undefined
    );
    return { linked, failed };
  };

  /**
   * «Oppdater», «Oppdater alle» and «Avlys her også»: writes only the chosen Google fields onto linked events.
   * Nothing else on the planner event (program, tasks, staffing, answers, theme, notes) is part of the write.
   */
  const applyCalendarChanges = (items: readonly { gathering: Gathering; event: ExternalCalendarEvent; fields: readonly CalendarField[] }[]) => {
    let updated = 0;
    let failed = 0;
    for (const { gathering, event, fields } of items) {
      if (fields.length === 0) continue;
      const patch = calendarPatch(fields, event);
      const result = studio.updateGathering(gathering.id, patch);
      if (!result.success) {
        failed++;
        continue;
      }
      updated++;
      gatheringsRef.current = gatheringsRef.current.map((g) => (g.id === gathering.id ? { ...g, ...patch } : g));
    }
    refreshQueue(gatheringsRef.current);
    if (updated === 0 && failed === 0) return { updated, failed };
    showFeedback(
      failed > 0
        ? `${updated} arrangementer oppdatert fra kirkens kalender. ${failed} kunne ikke oppdateres.`
        : `${updated} arrangementer oppdatert fra kirkens kalender.`,
      updated === 0 ? "error" : undefined
    );
    return { updated, failed };
  };

  /** «La være»: the app keeps its values. The row is hidden until Google changes again. */
  const declineChanges = async (event: ExternalCalendarEvent) => {
    if (!event.uid) return;
    const values: CalendarDeclined = declinedValuesOf(event);
    await declineExternalChange(event.uid, values);
    refreshQueue(gatheringsRef.current, { ...surfaces.calendarDeclined, [calendarNoteKey(event.uid)]: values });
  };

  const templateIdFor = (event: ExternalCalendarEvent): string | undefined => {
    const id = templateChoiceFor(event, templateByUid, templates);
    return id ?? undefined;
  };

  const formInitialFor = (event: ExternalCalendarEvent): GatheringFormValues => {
    const proposal = proposeImport(event, templates);
    let values = formValuesFromExternalEvent(event, groupId, proposal);
    const templateId = templateIdFor(event) || proposal.templateId || undefined;
    const template = templateId ? templates.find((t) => t.id === templateId) ?? null : null;
    if (template) {
      values = formValuesForTemplateApply(template, formValuesFromTemplate(template, values));
    }
    return values;
  };

  const setTemplateFor = (event: ExternalCalendarEvent, templateId: string) => {
    const key = event.uid || event.startsAt;
    setTemplateByUid((prev) => ({ ...prev, [key]: templateId }));
  };

  return {
    importOn,
    diff,
    feed: feedRows,
    pending,
    syncing,
    batchWorking,
    sync,
    createFromEvent,
    createAllNew: createAllNewPublic,
    afterFormCreate,
    dismiss,
    restore,
    keep,
    linkEvent,
    linkAll,
    applyCalendarChanges,
    declineChanges,
    dismissedUids: surfaces.dismissedUids,
    noteFor: (uid: string) => calendarNoteFor(surfaces, uid),
    formInitialFor,
    templateIdFor,
    setTemplateFor,
    groupReady: Boolean(groupId),
    importNewAutomatically: surfaces.importNewAutomatically,
  };
}

/** Menu badge: count of unresolved import rows without running sync again. */
export function useExternalCalendarPending(): number {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const listener = (diff: CalendarDiff | null) => setPending(pendingCount(diff));
    sharedListeners.add(listener);
    listener(sharedDiff);
    return () => {
      sharedListeners.delete(listener);
    };
  }, []);
  return pending;
}
