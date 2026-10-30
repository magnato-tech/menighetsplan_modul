import { useCallback, useEffect, useRef, useState } from "react";
import { useCms } from "../context/CmsContext";
import { dismissExternalUid, clearExternalCalendarImportQueue, keepExternalUid } from "../services/surfaces";
import { reportWriteError } from "../services/writeErrors";
import {
  diffCalendar,
  feedGatheringPatch,
  formValuesFromExternalEvent,
  gatheringsForImportReset,
  parseExternalCalendarFeed,
  proposeImport,
  type CalendarDiff,
  type ExternalCalendarEvent,
} from "../utils/externalCalendar";
import { icalImportOn } from "../utils/surfaces";
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
import type { ActionResult } from "../context/FirebaseDataContext";

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
  const [syncing, setSyncing] = useState(false);
  const [batchWorking, setBatchWorking] = useState(false);
  const [resetWorking, setResetWorking] = useState(false);
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
    (knownGatherings: readonly Gathering[]) => {
      const next = diffCalendar(lastFeedRef.current, knownGatherings, surfaces.dismissedUids, surfaces.keptUids);
      setSharedDiff(next);
      return next;
    },
    [surfaces.dismissedUids, surfaces.keptUids]
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

  const applyAutoUpdates = useCallback(
    (next: CalendarDiff) => {
      for (const { gathering, event } of next.updated) {
        if (!gathering.externalCalendarUid) continue;
        studio.updateGathering(gathering.id, feedGatheringPatch(gathering, event));
      }
    },
    [studio]
  );

  /** Hent feed og oppdater køen. Oppretter bare nye rader når `runImport` er true (batch eller innstilling under Database). */
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

        const dismissedUids = queueOverrides?.dismissedUids ?? surfaces.dismissedUids;
        const keptUids = queueOverrides?.keptUids ?? surfaces.keptUids;

        let known = gatheringsRef.current;
        let next = diffCalendar(feed, known, dismissedUids, keptUids);
        applyAutoUpdates(next);

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
      applyAutoUpdates,
      groupId,
      importNewEvents,
      importOn,
      showFeedback,
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

  const pending = (diff?.newEvents.length ?? 0) + (diff?.gone.length ?? 0);

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

  const dismiss = async (uid: string) => {
    await dismissExternalUid(uid);
    void syncFeed(false);
  };

  const keep = async (uid: string) => {
    await keepExternalUid(uid);
    void syncFeed(false);
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

  const importResetCandidateCount = gatheringsForImportReset(lastFeedRef.current, gatherings).length;

  /** Remove imported rows and queue choices, then fetch the feed again (and auto-create when enabled). */
  const resetImport = useCallback(
    async (deleteGathering: (gatheringId: string) => ActionResult) => {
      if (!importOn) return;
      setResetWorking(true);
      try {
        const response = await fetch("/api/kalender-innhold");
        const text = await response.text();
        if (!response.ok) throw new Error(text || `Kalenderen svarte ${response.status}`);
        const feed = parseExternalCalendarFeed(text);
        lastFeedRef.current = feed;

        const toRemove = gatheringsForImportReset(feed, gatheringsRef.current);
        const removedIds = new Set<string>();
        let deleteFailed = 0;
        for (const g of toRemove) {
          const res = deleteGathering(g.id);
          if (res.success) removedIds.add(g.id);
          else deleteFailed++;
        }
        gatheringsRef.current = gatheringsRef.current.filter((g) => !removedIds.has(g.id));

        await clearExternalCalendarImportQueue();
        setTemplateByUid({});

        await syncFeed(surfaces.importNewAutomatically, { dismissedUids: [], keptUids: [] });

        const removed = removedIds.size;
        if (removed === 0 && deleteFailed === 0) {
          showFeedback("Importkøen er tømt. Kalenderen er hentet på nytt.");
        } else if (deleteFailed > 0) {
          showFeedback(
            `${removed} arrangementer fjernet. ${deleteFailed} kunne ikke slettes — sjekk kalenderen.`,
            "error"
          );
        } else {
          showFeedback(
            surfaces.importNewAutomatically
              ? `${removed} importerte arrangementer fjernet. Nye rader opprettes automatisk fra feeden.`
              : `${removed} importerte arrangementer fjernet. Gå gjennom køen for å opprette på nytt.`
          );
        }
      } catch (error) {
        reportWriteError("nullstille kalenderimport", error);
        showFeedback(error instanceof Error ? error.message : "Kunne ikke nullstille importen", "error");
      } finally {
        setResetWorking(false);
      }
    },
    [importOn, showFeedback, surfaces.importNewAutomatically, syncFeed]
  );

  return {
    importOn,
    diff,
    pending,
    syncing,
    batchWorking,
    resetWorking,
    resetImport,
    importResetCandidateCount,
    sync,
    createFromEvent,
    createAllNew: createAllNewPublic,
    afterFormCreate,
    dismiss,
    keep,
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
    const listener = (diff: CalendarDiff | null) =>
      setPending((diff?.newEvents.length ?? 0) + (diff?.gone.length ?? 0));
    sharedListeners.add(listener);
    listener(sharedDiff);
    return () => {
      sharedListeners.delete(listener);
    };
  }, []);
  return pending;
}
