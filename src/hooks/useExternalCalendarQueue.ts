import { useCallback, useEffect, useState } from "react";
import { useCms } from "../context/CmsContext";
import { dismissExternalUid, keepExternalUid } from "../services/surfaces";
import { reportWriteError } from "../services/writeErrors";
import {
  diffCalendar,
  formValuesFromExternalEvent,
  parseExternalCalendarFeed,
  proposeImport,
  type CalendarDiff,
  type ExternalCalendarEvent,
} from "../utils/externalCalendar";
import { icalImportOn } from "../utils/surfaces";
import { useGatheringTemplates } from "./useGatheringTemplates";
import { defaultGroupId, type GatheringFormValues } from "../utils/gatheringForm";
import { createPlannedGathering, planGathering } from "../utils/gatheringTemplates";
import { onDay } from "../utils/gatheringForm";
import { hasPlanner } from "../utils/level";
import { useLevel } from "./useLevel";
import type { ShowFeedback, StudioData } from "../pages/admin/studio";

let sharedDiff: CalendarDiff | null = null;
let sharedListeners = new Set<(diff: CalendarDiff | null) => void>();

function setSharedDiff(diff: CalendarDiff | null) {
  sharedDiff = diff;
  sharedListeners.forEach((listener) => listener(diff));
}

/** Pending rows in the iCal import queue (shared between Kalender-fanen and menyen). */
export function useExternalCalendarQueue(studio: StudioData, showFeedback: ShowFeedback) {
  const { surfaces } = useCms();
  const { templates } = useGatheringTemplates();
  const withPlanner = hasPlanner(useLevel());
  const importOn = icalImportOn(surfaces);
  const gatherings = studio.adminGatherings.map((item) => item.gathering);

  const [diff, setDiff] = useState<CalendarDiff | null>(sharedDiff);
  const [syncing, setSyncing] = useState(false);
  const [templateByUid, setTemplateByUid] = useState<Record<string, string | "">>({});

  useEffect(() => {
    const listener = (next: CalendarDiff | null) => setDiff(next);
    sharedListeners.add(listener);
    return () => {
      sharedListeners.delete(listener);
    };
  }, []);

  const applyAutoUpdates = useCallback(
    (next: CalendarDiff) => {
      for (const { gathering, event } of next.updated) {
        studio.updateGathering(gathering.id, {
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location || undefined,
          cancelled: event.cancelled,
        });
      }
    },
    [studio]
  );

  const sync = useCallback(async () => {
    if (!importOn) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/kalender-innhold");
      const text = await response.text();
      if (!response.ok) throw new Error(text || `Kalenderen svarte ${response.status}`);
      const feed = parseExternalCalendarFeed(text);
      const next = diffCalendar(feed, gatherings, surfaces.dismissedUids, surfaces.keptUids);
      applyAutoUpdates(next);
      setSharedDiff(next);
      setTemplateByUid((prev) => {
        const copy = { ...prev };
        for (const event of next.newEvents) {
          const key = event.uid || event.startsAt;
          if (copy[key] !== undefined) continue;
          copy[key] = proposeImport(event, templates).templateId ?? "";
        }
        return copy;
      });
    } catch (error) {
      reportWriteError("hente kirkens kalender", error);
      showFeedback(error instanceof Error ? error.message : "Kunne ikke hente kirkens kalender", "error");
    } finally {
      setSyncing(false);
    }
  }, [applyAutoUpdates, gatherings, importOn, showFeedback, surfaces.dismissedUids, surfaces.keptUids, templates]);

  useEffect(() => {
    if (importOn) void sync();
    else setSharedDiff(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importOn, surfaces.externalCalendarUrl, surfaces.ownWebsite]);

  const pending = (diff?.newEvents.length ?? 0) + (diff?.gone.length ?? 0);

  const groupId = defaultGroupId(
    studio.adminGroups.map((item) => item.group),
    gatherings
  );

  const createFromEvent = (event: ExternalCalendarEvent, templateId: string | null) => {
    if (!groupId) {
      showFeedback("Opprett en gruppe først", "error");
      return;
    }
    const proposal = proposeImport(event, templates);
    const values = formValuesFromExternalEvent(event, groupId, proposal);
    const template = templateId ? templates.find((t) => t.id === templateId) ?? null : null;
    const result = createPlannedGathering(
      studio,
      planGathering(onDay(values, values.date), {
        template,
        roles: studio.adminVolunteerRoles,
        withPlanner,
        externalCalendarUid: event.uid || undefined,
      })
    );
    if (!result.success) {
      showFeedback(result.error || "Arrangementet ble ikke opprettet", "error");
      return;
    }
    showFeedback("Arrangementet er opprettet fra kirkens kalender.");
    void sync();
  };

  const dismiss = async (uid: string) => {
    await dismissExternalUid(uid);
    void sync();
  };

  const keep = async (uid: string) => {
    await keepExternalUid(uid);
    void sync();
  };

  const formInitialFor = (event: ExternalCalendarEvent): GatheringFormValues => {
    const proposal = proposeImport(event, templates);
    return formValuesFromExternalEvent(event, groupId, proposal);
  };

  const templateIdFor = (event: ExternalCalendarEvent): string | undefined => {
    const key = event.uid || event.startsAt;
    const chosen = templateByUid[key];
    return chosen === "" ? undefined : chosen || proposeImport(event, templates).templateId || undefined;
  };

  const setTemplateFor = (event: ExternalCalendarEvent, templateId: string) => {
    const key = event.uid || event.startsAt;
    setTemplateByUid((prev) => ({ ...prev, [key]: templateId }));
  };

  return {
    importOn,
    diff,
    pending,
    syncing,
    sync,
    createFromEvent,
    dismiss,
    keep,
    formInitialFor,
    templateIdFor,
    setTemplateFor,
    groupReady: Boolean(groupId),
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
