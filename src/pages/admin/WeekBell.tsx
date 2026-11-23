import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { isAdministrator, isWebEditor } from "../../utils/session";
import { missingThisWeek } from "../../utils/weekOnWebsite";
import { WeekOnWebsiteCard } from "./tabs/dashboard/WeekOnWebsiteCard";
import { useStudioAppearance } from "./studioAppearance";
import type { StudioData, StudioTab } from "./studio";

interface WeekBellProps {
  studio: StudioData;
  onTabChange: (tab: StudioTab) => void;
}

/**
 * The bell in the phone top bar: «Denne uka på nettsiden» as a panel over the page, with the number of
 * events that miss something on the website before Sunday. Only for those who edit the website.
 */
export const WeekBell: React.FC<WeekBellProps> = ({ studio, onTabChange }) => {
  const { pages, news, surfaces } = useCms();
  const { contentTheme } = useStudioAppearance();
  const [open, setOpen] = useState(false);
  // The moment the week is counted from: now when the bell is shown, and again each time the panel opens
  const [now, setNow] = useState(() => Date.now());
  const bellRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const user = studio.currentUser;
  const canEdit = Boolean(user && (isAdministrator(user) || isWebEditor(user))) && surfaces.ownWebsite;
  const gatherings = useMemo(() => (studio.adminGatherings ?? []).map((item) => item.gathering), [studio.adminGatherings]);
  const missingCount = canEdit ? missingThisWeek(gatherings, now).filter((item) => item.missing.length > 0).length : 0;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // With the «Bilde og tekst» window open on top, Escape does not close the whole panel
      if (event.key === "Escape" && document.querySelectorAll('[role="dialog"]').length <= 1) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!canEdit) return null;

  const openPanel = () => {
    setNow(Date.now());
    setOpen(true);
  };
  function close() {
    setOpen(false);
    bellRef.current?.focus();
  }
  const nameOf = (personId: string) => studio.adminPersons?.find((entry) => entry.person?.id === personId)?.person?.name;
  const label = missingCount > 0 ? `Denne uka, ${missingCount} mangler før søndag` : "Denne uka";

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={openPanel}
        aria-label={label}
        aria-haspopup="dialog"
        className="relative p-2 rounded-lg bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {missingCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center"
          >
            {missingCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-950/60" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="denne-uka-tittel"
            data-studio-theme={contentTheme}
            style={{ colorScheme: contentTheme }}
            className="fixed inset-x-3 top-16 bottom-4 z-50 flex flex-col rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] shadow-xl text-[var(--studio-text)]"
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--studio-border)]">
              <h2 id="denne-uka-tittel" className="font-black text-sm">
                Denne uka
              </h2>
              <button
                ref={closeRef}
                type="button"
                aria-label="Lukk"
                onClick={close}
                className="p-2 rounded-lg bg-[var(--studio-bg)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <WeekOnWebsiteCard
                inPanel
                pages={pages}
                news={news}
                gatherings={gatherings}
                nameOf={nameOf}
                now={now}
                onTabChange={(tab) => {
                  close();
                  onTabChange(tab);
                }}
                onSaveGathering={(id, updates) => studio.updateGathering(id, updates)}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
};
