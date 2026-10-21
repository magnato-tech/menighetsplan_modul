import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatNorwegianDateTime,
  combineDateAndTimeToIso,
  parseIsoToDateAndTime,
  moveByDays,
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
  Repeat,
  CalendarClock,
  LayoutGrid,
  Table2,
  Trash2,
  MoreHorizontal,
  ChevronRight,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { visibilityOf } from "../../../utils/visibility";
import { DEFAULT_LOCATION, isWorshipService, locationOf } from "../../../utils/gatherings";
import { NewGatheringDialog } from "../NewGatheringDialog";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { movedRestOfSeries } from "../../../utils/series";
import { DeleteGatheringDialog, type StaffedTask } from "../DeleteGatheringDialog";
import { MoveSeriesDialog } from "../MoveSeriesDialog";
import { GatheringsTable } from "./gatherings/GatheringsTable";
import { GatheringsCalendar, KIND_COLORS } from "./gatherings/GatheringsCalendar";
import { CALENDAR_KINDS, filterByKinds, type CalendarKind } from "../../../utils/adminCalendar";
import { gatheringsInPeriod, nextGatheringSort, type GatheringPeriod, type GatheringSortDirection, type GatheringSortKey } from "../../../utils/gatheringList";
import { defaultGroupId, newGatheringForm, type GatheringFormValues } from "../../../utils/gatheringForm";

interface GatheringsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
  /** The overview asked for a new event: the form opens at once. */
  createRequested?: boolean;
  onCreateHandled?: () => void;
}

type GatheringsView = "month" | "week" | "cards" | "table";
const VIEW_KEY = "menighetsplan_kalender_visning";
const KINDS_KEY = "menighetsplan_kalender_filter";
const isView = (value: unknown): value is GatheringsView => value === "month" || value === "week" || value === "cards" || value === "table";
const isKinds = (value: unknown): value is CalendarKind[] =>
  Array.isArray(value) && value.every((kind) => CALENDAR_KINDS.some((option) => option.value === kind));

/** A choice remembered in this browser. Without one, or where the browser keeps nothing, the start value. */
function readStored<T>(key: string, start: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return valid(value) ? value : start;
  } catch {
    return start;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser that keeps nothing forgets the choice; the calendar works the same
  }
}

export const GatheringsTab: React.FC<GatheringsTabProps> = ({ studio, showFeedback, createRequested, onCreateHandled }) => {
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

  // A new event is made in the full form, opened with «+». It is mostly done once a term, when the
  // term is planned, so the list of events comes first. The event goes to the group that holds the
  // calendar; who does what is settled task by task. The form can still name a group.
  const groups = adminGroups.map(({ group }) => group);
  const responsibleGroupId = defaultGroupId(groups, adminGatherings.map((item) => item.gathering));
  const [fullForm, setFullForm] = useState<GatheringFormValues | null>(null);
  const openFullForm = (date?: string) => setFullForm(newGatheringForm({ groupId: responsibleGroupId, ...(date ? { date } : {}) }));
  // Opened from «Opprett ny gudstjeneste eller samling» on the overview
  useEffect(() => {
    if (!createRequested) return;
    openFullForm();
    onCreateHandled?.();
  }, [createRequested]);

  const { assignments, deleteGatheringWithStaffing, getPersonById } = useFirebase();

  // The events as a month, a week, cards or a table. The choice is remembered in this browser.
  const [chosenView, setChosenView] = useState<GatheringsView>(() => readStored(VIEW_KEY, "table", isView));
  const setView = (next: GatheringsView) => {
    setChosenView(next);
    store(VIEW_KEY, next);
  };
  // A phone gets the cards or the week: a month and a table do not fit it
  const wide = useMediaQuery("(min-width: 768px)");
  const view: GatheringsView = wide ? chosenView : chosenView === "week" ? "week" : "cards";
  const calendarView = view === "month" || view === "week";
  // The day the month or the week is drawn around
  const [anchor, setAnchor] = useState(() => new Date());
  // The filter buttons; none on is «Alle». Remembered in this browser, and the same for every view.
  const [kinds, setKindsState] = useState<CalendarKind[]>(() => readStored(KINDS_KEY, [] as CalendarKind[], isKinds));
  const setKinds = (next: CalendarKind[]) => {
    setKindsState(next);
    store(KINDS_KEY, next);
  };
  // From the latest choice, so two quick presses both count
  const toggleKind = (kind: CalendarKind) =>
    setKindsState((current) => {
      const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
      store(KINDS_KEY, next);
      return next;
    });
  const filteredGatherings = useMemo(() => filterByKinds(adminGatherings, kinds), [adminGatherings, kinds]);
  const [sortKey, setSortKey] = useState<GatheringSortKey>("date");
  const [sortDirection, setSortDirection] = useState<GatheringSortDirection>("asc");
  // Coming events first; the held ones are a press away
  const [period, setPeriod] = useState<GatheringPeriod>("kommende");
  const sortedGatherings = useMemo(
    () => gatheringsInPeriod(filteredGatherings, period, Date.now(), sortKey, sortDirection),
    [filteredGatherings, period, sortKey, sortDirection]
  );
  // On a phone the secondary actions of a card are behind «…»
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const handleSort = (key: GatheringSortKey) => {
    const next = nextGatheringSort(sortKey, sortDirection, key);
    setSortKey(next.key);
    setSortDirection(next.direction);
  };
  // The next event is suggested at the same time of day and place as the one it follows
  const startNextAfter = (item: AdminGatheringItem) => {
    setNextGatheringSource(item);
    setNextGatheringDate("");
    setNextGatheringTime(parseIsoToDateAndTime(item.gathering.startsAt).time);
    setNextGatheringLocation(item.gathering.location || "");
  };

  // The rest of a series moved to other days, when the rhythm turned out to be a week off.
  // Everything on the events follows: programme, tasks and the people on them.
  const [movingFrom, setMovingFrom] = useState<AdminGatheringItem | null>(null);
  const moveRestOfSeries = (item: AdminGatheringItem, days: number) => {
    const moved = movedRestOfSeries(
      adminGatherings.map((other) => other.gathering),
      item.gathering,
      days,
      moveByDays
    );
    for (const { id, ...times } of moved) studio.updateGathering(id, times);
    setMovingFrom(null);
    showFeedback(`${moved.length} ${moved.length === 1 ? "arrangement" : "arrangementer"} i serien ble flyttet`);
  };

  // An event with people on its tasks is deleted through a warning that names them. One press
  // there takes them all off and deletes the event, so they need not be removed one by one.
  const [deleting, setDeleting] = useState<AdminGatheringItem | null>(null);
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
  const deleteWithStaffing = (item: AdminGatheringItem) => {
    const res = deleteGatheringWithStaffing(item.gathering.id);
    setDeleting(null);
    if (res.success) showFeedback("Arrangementet ble slettet, og alle ble tatt av oppgavene");
    else showFeedback(res.error || "Kunne ikke slette arrangementet", "error");
  };

  const handleDeleteGathering = (item: AdminGatheringItem) => {
    const g = item.gathering;
    if (staffedTasksOf(item).length > 0) {
      setDeleting(item);
      return;
    }
    if (!confirm(`Vil du slette «${g.title}» (${formatNorwegianDateTime(g.startsAt)})? Program og oppgaver fjernes også.`)) {
      return;
    }
    const res = deleteGatheringWithStaffing(g.id);
    if (res.success) showFeedback("Arrangementet ble slettet");
    else showFeedback(res.error || "Kunne ikke slette arrangementet", "error");
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Kalender</h2>
            <p className="text-xs text-[var(--studio-muted)] hidden sm:block">Gudstjenester, møter og samlinger.</p>
          </div>
          <button
            type="button"
            onClick={() => openFullForm()}
            aria-label="Nytt arrangement"
            className="shrink-0 w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-sm cursor-pointer"
          >
            <Plus className="w-6 h-6" aria-hidden />
          </button>
        </div>

        {/* The filter buttons, as in many church calendars: none on shows all */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Vis">
          <button
            type="button"
            onClick={() => setKinds([])}
            aria-pressed={kinds.length === 0}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
              kinds.length === 0 ? "bg-indigo-600 border-indigo-600 text-white" : "border-[var(--studio-border)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
          >
            Alle
          </button>
          {CALENDAR_KINDS.map(({ value, label }) => {
            const on = kinds.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleKind(value)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                  on ? `${KIND_COLORS[value]} border-transparent text-white` : "border-[var(--studio-border)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${on ? "bg-white" : KIND_COLORS[value]}`} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          {!calendarView && (
          <div className="inline-flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5" role="group" aria-label="Periode">
            {(["kommende", "tidligere"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  period === p ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                }`}
              >
                {p === "kommende" ? "Kommende" : "Tidligere"}
              </button>
            ))}
          </div>
          )}
          {!calendarView && (
          <p className="text-xs text-[var(--studio-muted)] ml-auto">
            {sortedGatherings.length} {sortedGatherings.length === 1 ? "arrangement" : "arrangementer"}
          </p>
          )}
          <div className="inline-flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5 ml-auto" role="group" aria-label="Visning">
            {wide && (
            <button
              type="button"
              onClick={() => setView("month")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                view === "month" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              }`}
              aria-pressed={view === "month"}
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              Måned
            </button>
            )}
            <button
              type="button"
              onClick={() => setView("week")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                view === "week" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              }`}
              aria-pressed={view === "week"}
            >
              <CalendarRange className="w-3.5 h-3.5" aria-hidden="true" />
              Uke
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                view === "cards" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              }`}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              Kort
            </button>
            {wide && (
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                view === "table" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              }`}
              aria-pressed={view === "table"}
            >
              <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
              Tabell
            </button>
            )}
          </div>
        </div>

        {calendarView && (
          <GatheringsCalendar
            items={filteredGatherings}
            mode={view === "month" ? "month" : "week"}
            anchor={anchor}
            onAnchorChange={setAnchor}
            onShowWeek={(day) => {
              setAnchor(day);
              setView("week");
            }}
            onNewOnDay={(day) => openFullForm(day)}
            narrow={!wide}
          />
        )}

        {view === "table" && (
          <GatheringsTable
            rows={sortedGatherings}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onMoveRest={setMovingFrom}
            onNext={startNextAfter}
            onDelete={handleDeleteGathering}
          />
        )}

        {/* Gatherings List */}
        {view === "cards" && (
        <div className="space-y-3">
          {sortedGatherings.map((item) => {
            const g = item.gathering;
            const staffing = item.staffing;

            return (
              <div
                key={g.id}
                className="p-4 sm:p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                {/* The whole card opens the event; on a phone that is the one thing it is for */}
                <div className="flex items-start gap-2">
                <Link to={`/admin/samling/${g.id}?vis=bemanning`} className="space-y-1 min-w-0 flex-1 group">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[var(--studio-text)] text-base group-hover:underline">{g.title}</h3>
                    {isWorshipService(g) && (
                      <span className="text-[10px] font-bold text-[var(--studio-accent-text)] bg-[var(--studio-accent-bg)] px-2 py-0.5 rounded">
                        Gudstjeneste
                      </span>
                    )}
                    {g.seriesId && (
                      <span className="text-[10px] font-bold text-[var(--studio-muted)] bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-0.5 rounded flex items-center gap-1">
                        <Repeat className="w-3 h-3" aria-hidden="true" />
                        Del av serie
                      </span>
                    )}

                    {/* Staffing Status with SVG icon (WCAG AA) */}
                    {item.totalTasks === 0 && (
                      <span className="text-[10px] font-bold text-[var(--studio-muted)] bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-0.5 rounded">
                        Ingen oppgaver
                      </span>
                    )}
                    {item.totalTasks !== 0 && staffing.color === "green" && (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Dekket ({item.coveredTasksCount}/{item.totalTasks})
                      </span>
                    )}
                    {item.totalTasks !== 0 && staffing.color === "yellow" && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Venter på svar
                      </span>
                    )}
                    {item.totalTasks !== 0 && staffing.color === "red" && (
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
                </Link>
                <button
                  type="button"
                  onClick={() => setOpenActionsId(openActionsId === g.id ? null : g.id)}
                  aria-expanded={openActionsId === g.id}
                  aria-label={`Flere valg for ${g.title}`}
                  className="sm:hidden p-2 -mr-2 rounded-lg text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] cursor-pointer"
                >
                  <MoreHorizontal className="w-5 h-5" aria-hidden />
                </button>
                </div>

                <div className={`flex-wrap items-center gap-2 ${openActionsId === g.id ? "flex" : "hidden sm:flex"}`}>
                  {g.seriesId && (
                    <button
                      type="button"
                      onClick={() => setMovingFrom(item)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-accent-bg)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[var(--studio-border)]"
                      title="Flytter dette arrangementet og de som kommer etter i serien, like mange dager"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Flytt resten av serien</span>
                    </button>
                  )}
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

                  <button
                    type="button"
                    onClick={() => handleDeleteGathering(item)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[var(--studio-border)]"
                    title="Slett dette arrangementet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Slett</span>
                  </button>

                  <Link
                    to={`/admin/samling/${g.id}?vis=program`}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Kjøreplan</span>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {fullForm && (
        <NewGatheringDialog studio={studio} showFeedback={showFeedback} initial={fullForm} onClose={() => setFullForm(null)} />
      )}

      {deleting && (
        <DeleteGatheringDialog
          title={deleting.gathering.title}
          when={formatNorwegianDateTime(deleting.gathering.startsAt)}
          staffed={staffedTasksOf(deleting)}
          onConfirm={() => deleteWithStaffing(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      {movingFrom && (
        <MoveSeriesDialog
          from={movingFrom.gathering}
          gatherings={adminGatherings.map((other) => other.gathering)}
          staffedCount={
            adminGatherings.filter(
              (other) =>
                other.gathering.seriesId === movingFrom.gathering.seriesId &&
                new Date(other.gathering.startsAt).getTime() >= new Date(movingFrom.gathering.startsAt).getTime() &&
                other.tasks.some((task) => assignments.some((assignment) => assignment.taskId === task.id))
            ).length
          }
          onMove={(days) => moveRestOfSeries(movingFrom, days)}
          onClose={() => setMovingFrom(null)}
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
