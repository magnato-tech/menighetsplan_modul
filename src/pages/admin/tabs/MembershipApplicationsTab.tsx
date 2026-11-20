import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DEMO } from "../../../demo";
import { ClipboardList } from "lucide-react";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { useMembershipApplications } from "../../../hooks/useMembershipApplications";
import { useMembershipClerkTasks } from "../../../hooks/useMembershipClerkTasks";
import { openClerkTasks } from "../../../utils/membershipClerkTasks";
import { canManageMembershipApplications } from "../membershipClerk";
import {
  ensureDemoMembershipClerkBoard,
  ensureEnrollmentDateCorrectionTasks,
} from "../../../services/membershipClerkTasks";
import { reportWriteError } from "../../../services/writeErrors";
import type { ShowFeedback } from "../studio";
import { MembershipClerkTaskCard } from "../membership/MembershipClerkTaskCard";
import { MembershipClerkInboxList } from "../membership/MembershipClerkInboxList";
import { MembershipProtocolLogPanel } from "../membership/MembershipProtocolLogPanel";

type BoardTab = "inbox" | "log";

export const MembershipApplicationsTab: React.FC<{ showFeedback: ShowFeedback }> = ({ showFeedback }) => {
  const { currentUser, allPersons } = useFirebase();
  const { settings } = useCms();
  const enabled = canManageMembershipApplications(currentUser);
  const tasks = useMembershipClerkTasks(enabled);
  const applications = useMembershipApplications(enabled);
  const open = useMemo(() => openClerkTasks(tasks), [tasks]);
  const [boardTab, setBoardTab] = useState<BoardTab>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("vis") === "log") setBoardTab("log");
  }, [searchParams]);

  useEffect(() => {
    if (!enabled) return;
    if (DEMO === null && seeded) return;
    (async () => {
      try {
        if (DEMO !== null) {
          await ensureDemoMembershipClerkBoard(allPersons, settings.churchName || "Menigheten", tasks);
        } else {
          await ensureEnrollmentDateCorrectionTasks(allPersons);
          setSeeded(true);
        }
      } catch (error) {
        reportWriteError("synk oppgaver", error);
      }
    })();
  }, [allPersons, enabled, seeded, settings.churchName, tasks]);

  useEffect(() => {
    if (open.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !open.some((t) => t.id === selectedId)) {
      setSelectedId(open[0].id);
    }
  }, [open, selectedId]);

  const selectedIndex = selectedId ? open.findIndex((t) => t.id === selectedId) : -1;
  const current = selectedIndex >= 0 ? open[selectedIndex] : null;
  const application =
    current?.applicationId != null ? applications.find((a) => a.id === current.applicationId) ?? null : null;
  const person = current ? allPersons.find((p) => p.id === current.personId) : undefined;

  const goNextWithoutComplete = () => {
    if (open.length === 0) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const next = open[(idx + 1) % open.length];
    setSelectedId(next.id);
  };

  const afterComplete = () => {
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const remaining = open.filter((t) => t.id !== selectedId);
    if (remaining.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId(remaining[Math.min(idx, remaining.length - 1)].id);
  };

  if (!enabled) {
    return <p className="text-sm text-[var(--studio-muted)]">Du har ikke tilgang til medlemskapssøknader.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="border-b border-[var(--studio-border)] pb-4">
        <h1 className="text-xl sm:text-2xl font-black text-[var(--studio-text)] tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-500" aria-hidden="true" />
          Oppgavebord – medlemskap
        </h1>
        <p className="text-xs text-[var(--studio-muted)] mt-2 max-w-2xl leading-relaxed">
          Arbeidsflyt for protokollansvarlig: åpne saker til venstre, utfør stegene til høyre. Du kan hoppe videre uten å
          lukke en sak.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setBoardTab("inbox")}
          className={`px-4 py-2 rounded-lg ${
            boardTab === "inbox" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
          }`}
        >
          Til behandling ({open.length})
        </button>
        <button
          type="button"
          onClick={() => setBoardTab("log")}
          className={`px-4 py-2 rounded-lg ${
            boardTab === "log" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
          }`}
        >
          Protokoll-logg (siste år)
        </button>
      </div>

      {boardTab === "log" ? (
        <MembershipProtocolLogPanel tasks={tasks} persons={allPersons} applications={applications} />
      ) : open.length === 0 ? (
        <p className="text-sm text-[var(--studio-muted)] rounded-xl border border-[var(--studio-border)] px-4 py-8 text-center">
          Ingen åpne oppgaver akkurat nå.
        </p>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="w-full lg:w-[30%] shrink-0 space-y-2">
            <MembershipClerkInboxList
              tasks={open}
              applications={applications}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="w-full lg:w-[70%] min-w-0 space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                disabled={open.length < 2 || busy}
                onClick={goNextWithoutComplete}
                className="text-xs font-bold text-indigo-500 disabled:opacity-40"
              >
                Neste uten å lukke
              </button>
            </div>
            {current && (
              <MembershipClerkTaskCard
                key={current.id}
                task={current}
                application={application}
                person={person}
                churchName={settings.churchName ?? "Menigheten"}
                personBirthDate={person?.birthDate}
                personEmail={person?.email}
                clerkId={currentUser!.id}
                busy={busy}
                setBusy={setBusy}
                onSaved={(text) => showFeedback(text, "success")}
                onError={(text) => showFeedback(text, "error")}
                onCompleted={afterComplete}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};