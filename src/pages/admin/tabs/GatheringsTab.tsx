import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatNorwegianDateTime,
  combineDateAndTimeToIso,
  parseIsoToDateAndTime,
  AdminGatheringItem,
} from "../../../hooks/useAppHooks";
import {
  Plus,
  CheckCircle2,
  Clock,
  ListTodo,
  AlertTriangle,
  X,
  CalendarPlus,
  SlidersHorizontal,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { visibilityOf } from "../../../utils/visibility";
import { DEFAULT_LOCATION, isWorshipService, locationOf } from "../../../utils/gatherings";
import { GatheringFormDialog } from "../../../components/gathering/GatheringFormDialog";
import { useLevel } from "../../../hooks/useLevel";
import { defaultGroupId, newGatheringForm, newGatheringOf, type GatheringFormValues } from "../../../utils/gatheringForm";
import { hasPlanner } from "../../../utils/level";

interface GatheringsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

export const GatheringsTab: React.FC<GatheringsTabProps> = ({ studio, showFeedback }) => {
  const { adminGatherings, adminGroups, createGathering, createTask } = studio;

  // "Lag neste arrangement" Modal State
  const [nextGatheringSource, setNextGatheringSource] = useState<AdminGatheringItem | null>(null);
  const [nextGatheringDate, setNextGatheringDate] = useState("");
  const [nextGatheringTime, setNextGatheringTime] = useState("11:00");
  const [nextGatheringLocation, setNextGatheringLocation] = useState("");

  const handleCreateNextGathering = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextGatheringSource || !nextGatheringDate) {
      showFeedback("Vennligst oppgi dato for det nye arrangementet", "error");
      return;
    }
    // Stored as an exact moment. A bare "date + clock time" would be read in whatever
    // time zone the reader happens to be in, and the server is not in Norway.
    const isoDateTime = combineDateAndTimeToIso(nextGatheringDate, nextGatheringTime);
    const sourceG = nextGatheringSource.gathering;
    const res = createGathering({
      title: sourceG.title,
      groupId: sourceG.groupId,
      startsAt: isoDateTime,
      location: nextGatheringLocation.trim() || undefined,
      theme: sourceG.theme,
      type: sourceG.type,
      // An internal gathering stays internal when it is copied, also one from before `visibility` existed
      visibility: visibilityOf(sourceG),
      isGudstjeneste: isWorshipService(sourceG),
    });
    if (!res.success || !res.gathering) {
      showFeedback("Kunne ikke opprette arrangementet", "error");
      return;
    }
    const newGatheringId = res.gathering.id;
    // Clone tasks with neededCount, but clean/empty assignments!
    for (const t of nextGatheringSource.tasks) {
      createTask({
        gatheringId: newGatheringId,
        groupId: t.groupId,
        title: t.title,
        description: t.description,
        instruction: t.instruction,
        status: "open",
        neededCount: t.neededCount || 1,
      });
    }
    setNextGatheringSource(null);
    showFeedback(`Nytt arrangement opprettet for ${nextGatheringDate} med ${nextGatheringSource.tasks.length} oppgaver klonet!`);
  };

  // ==========================================
  // NY SAMLING FORM STATE (PLANLEGGER)
  // ==========================================
  const [newGatheringTitle, setNewGatheringTitle] = useState("");
  const [newGatheringDate, setNewGatheringDate] = useState("");
  const [newGatheringTime, setNewGatheringTime] = useState("11:00");
  const [newGatheringTheme, setNewGatheringTheme] = useState("");
  const [newGatheringGroupId, setNewGatheringGroupId] = useState("");
  const [newGatheringIsWorship, setNewGatheringIsWorship] = useState(true);
  // Every gathering has a responsible group. One is chosen until the admin picks another, and on
  // the level without the planner nobody picks: the event goes to the group that holds the calendar.
  const withPlanner = hasPlanner(useLevel());
  const groups = adminGroups.map(({ group }) => group);
  const responsibleGroupId = (withPlanner && newGatheringGroupId) || defaultGroupId(groups, withPlanner);

  // The full form, opened with what has been written in the quick one
  const [fullForm, setFullForm] = useState<GatheringFormValues | null>(null);
  const openFullForm = () =>
    setFullForm(
      newGatheringForm({
        title: newGatheringTitle,
        date: newGatheringDate,
        time: newGatheringTime,
        theme: newGatheringTheme,
        groupId: responsibleGroupId,
        isGudstjeneste: newGatheringIsWorship,
      })
    );
  const handleSaveFullForm = (values: GatheringFormValues) => {
    const result = createGathering(newGatheringOf(values));
    if (!result.success) return result;
    setNewGatheringTitle("");
    setNewGatheringDate("");
    setNewGatheringTheme("");
    showFeedback("Nytt arrangement opprettet og lagt i kalenderen!");
    return result;
  };

  const handleCreateGathering = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGatheringTitle || !newGatheringDate) {
      showFeedback("Tittel og dato må fylles ut", "error");
      return;
    }
    if (!responsibleGroupId) {
      showFeedback("Opprett en gruppe først. En samling må ha en ansvarlig gruppe.", "error");
      return;
    }

    const iso = combineDateAndTimeToIso(newGatheringDate, newGatheringTime);
    createGathering({
      title: newGatheringTitle,
      groupId: responsibleGroupId,
      startsAt: iso,
      type: "arrangement",
      theme: newGatheringTheme.trim() || undefined,
      isGudstjeneste: newGatheringIsWorship,
    });

    setNewGatheringTitle("");
    setNewGatheringDate("");
    setNewGatheringTheme("");
    showFeedback("Ny samling opprettet og synkronisert til kalenderen!");
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Gudstjenester & Møter</h2>
            <p className="text-xs text-[var(--studio-muted)]">
              Full oversikt over menighetens samlinger. Opprett nye og administrer oppgaver.
            </p>
          </div>
        </div>

        {/* Quick Create Gathering Form */}
        <form onSubmit={handleCreateGathering} className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Opprett ny samling</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={newGatheringTitle}
                onChange={(e) => setNewGatheringTitle(e.target.value)}
                placeholder="Tittel, f.eks. Søndagsgudstjeneste & dåp"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>
            <div>
              <input
                type="date"
                value={newGatheringDate}
                onChange={(e) => setNewGatheringDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>
            <div>
              <input
                type="time"
                value={newGatheringTime}
                onChange={(e) => setNewGatheringTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={newGatheringTheme}
                onChange={(e) => setNewGatheringTheme(e.target.value)}
                placeholder="Valgfritt tema..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
            {withPlanner && (
            <div className="sm:col-span-2">
              <select
                value={responsibleGroupId}
                onChange={(e) => setNewGatheringGroupId(e.target.value)}
                aria-label="Ansvarlig gruppe"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              >
                {adminGroups.length === 0 && <option value="">Ingen grupper finnes ennå</option>}
                {adminGroups.map(({ group }) => (
                  <option key={group.id} value={group.id}>
                    Ansvarlig gruppe: {group.name}
                  </option>
                ))}
              </select>
            </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-[var(--studio-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={newGatheringIsWorship}
                onChange={(e) => setNewGatheringIsWorship(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
              />
              <span>Dette er en gudstjeneste</span>
            </label>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Everything else an event can have: end, place, Bible text, who sees it, template and series */}
              <button
                type="button"
                onClick={openFullForm}
                className="px-4 py-2 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
                Flere valg
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm"
              >
                Legg til i planleggeren
              </button>
            </div>
          </div>
        </form>

        {/* Gatherings List */}
        <div className="space-y-3">
          {adminGatherings.map((item) => {
            const g = item.gathering;
            const staffing = item.staffing;

            return (
              <div
                key={g.id}
                className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[var(--studio-text)] text-base">{g.title}</h3>
                    {isWorshipService(g) && (
                      <span className="text-[10px] font-bold text-[var(--studio-accent-text)] bg-[var(--studio-accent-bg)] px-2 py-0.5 rounded">
                        Gudstjeneste
                      </span>
                    )}

                    {/* Staffing Status with SVG icon (WCAG AA) */}
                    {staffing.color === "green" && (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Dekket ({item.coveredTasksCount}/{item.totalTasks})
                      </span>
                    )}
                    {staffing.color === "yellow" && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Venter på svar
                      </span>
                    )}
                    {staffing.color === "red" && (
                      <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Mangler {item.missingStaffingCount} frivillige
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--studio-muted)]">
                    {formatNorwegianDateTime(g.startsAt)} · {locationOf(g)}
                    {g.theme && ` · Tema: ${g.theme}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // The next one is suggested at the same time of day and place as this one
                      setNextGatheringSource(item);
                      setNextGatheringDate("");
                      setNextGatheringTime(parseIsoToDateAndTime(g.startsAt).time);
                      setNextGatheringLocation(g.location || "");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[var(--studio-border)]"
                    title="Opprett neste arrangement og klon oppgaver med tom personliste"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
                    <span>Lag neste arrangement</span>
                  </button>

                  <Link
                    to={`/admin/samling/${g.id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Oppgaver & Kjøreplan</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {fullForm && (
        <GatheringFormDialog
          isNew
          initial={fullForm}
          groups={groups}
          showGroup={withPlanner}
          onSave={handleSaveFullForm}
          onClose={() => setFullForm(null)}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 1: LAG NESTE ARRANGEMENT (KLON OPPGAVER)            */}
      {/* ========================================================= */}
      {nextGatheringSource && (
        <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--studio-accent-bg)] border border-indigo-700/80 flex items-center justify-center text-[var(--studio-icon)]">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--studio-text)]">Lag neste arrangement</h3>
                  <p className="text-[11px] text-[var(--studio-muted)]">Kloner oppgaver og bemanningsbehov</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNextGatheringSource(null)}
                className="text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-xs text-[var(--studio-muted)] space-y-1.5">
              <p className="font-semibold text-[var(--studio-text)]">
                Kilde: {nextGatheringSource.gathering.title}
              </p>
              <p className="text-[11px] text-[var(--studio-muted)]">
                Systemet oppretter et nytt arrangement og kopierer over alle {nextGatheringSource.tasks.length} oppgaver med antallet hver av dem trenger. Personlisten etterlates tom slik at frivillige kan tildeles eller inviteres på nytt.
              </p>
            </div>

            <form onSubmit={handleCreateNextGathering} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--studio-muted)]">Dato for nytt arrangement *</label>
                  <input
                    type="date"
                    value={nextGatheringDate}
                    onChange={(e) => setNextGatheringDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--studio-muted)]">Klokkeslett *</label>
                  <input
                    type="time"
                    value={nextGatheringTime}
                    onChange={(e) => setNextGatheringTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[var(--studio-muted)]">Lokasjon</label>
                <input
                  type="text"
                  value={nextGatheringLocation}
                  onChange={(e) => setNextGatheringLocation(e.target.value)}
                  placeholder={`Tomt felt betyr ${DEFAULT_LOCATION}`}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] focus:outline-hidden focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setNextGatheringSource(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-xs font-semibold cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Opprett & klon {nextGatheringSource.tasks.length} oppgaver</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
