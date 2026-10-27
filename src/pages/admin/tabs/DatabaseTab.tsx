import React, { useState } from "react";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import {
  populateCustomMockData,
  clearPlannerTestData,
  deleteAllData,
  restoreFullMockDatabase,
  type DatabaseAdminResult,
} from "../../../services/databaseAdmin";
import { DEFAULT_VOLUNTEER_ROLE_NAMES } from "../../../data/defaultVolunteerRoles";
import { FULL_DEMO_COUNTS } from "../../../data/mockDocuments";
import { ShowFeedback, StudioData } from "../studio";
import { DatabaseTestdataTab } from "../../../components/admin/DatabaseTestdataTab";
import { SimulationPanel } from "../../../components/admin/SimulationPanel";
import { DatasetPanel } from "../../../components/admin/DatasetPanel";
import { ChatResetPanel } from "../../../components/admin/ChatResetPanel";
import { ChurchPickerPanel } from "../../../components/admin/ChurchPickerPanel";
import { OperatingModePanel } from "../../../components/admin/OperatingModePanel";
import { useOperatingMode } from "../../../hooks/useOperatingMode";
import { isAddonOn } from "../../../utils/addons";
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Users,
  FolderKanban,
  Calendar,
  ListTodo,
  FileText,
  Radio,
  Sliders,
  Check,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface DatabaseTabProps {
  studio?: StudioData;
  showFeedback: ShowFeedback;
}

interface PresetPackage {
  id: string;
  name: string;
  description: string;
  persons: number;
  groups: number;
  gatherings: number;
  tasks: number;
  tag: string;
}

const PRESET_PACKAGES: PresetPackage[] = [
  {
    id: "compact",
    name: "Kompakt testsett",
    description: "Hovedpastor, daglig leder, menighetsråd og kjerneaktiviteter.",
    persons: 8,
    groups: 3,
    gatherings: 4,
    tasks: 6,
    tag: "8 personer",
  },
  {
    id: "medium",
    name: "Mellomstor menighet",
    description: "Pastorer, rådsmedlemmer, stabsdiakon, lovsangsteam og barnekirke.",
    persons: 16,
    groups: 6,
    gatherings: 10,
    tasks: 14,
    tag: "16 personer",
  },
  {
    id: "full",
    name: "Fullskala menighet",
    description: `Komplett menighetsregister: ${FULL_DEMO_COUNTS.personCount} personer, ${FULL_DEMO_COUNTS.groupCount} grupper, samlinger og oppgaver.`,
    persons: FULL_DEMO_COUNTS.personCount ?? 0,
    groups: FULL_DEMO_COUNTS.groupCount ?? 0,
    gatherings: FULL_DEMO_COUNTS.gatheringCount ?? 0,
    tasks: FULL_DEMO_COUNTS.taskCount ?? 0,
    tag: `${FULL_DEMO_COUNTS.personCount} personer (Maks)`,
  },
];

export const DatabaseTab: React.FC<DatabaseTabProps> = ({ showFeedback }) => {
  const {
    isFirestoreConnected,
    allPersons,
    groups,
    gatherings,
    tasks,
    assignments,
    } = useFirebase();

  const { pages, news, sermons, staff, addons } = useCms();

  // In production nothing can be emptied from this tab. The services refuse on their own; the
  // buttons that only delete are also locked here, so the lock is seen before it is met.
  const operatingMode = useOperatingMode();
  const deletionLocked = operatingMode !== "demo";

  // Custom counts state
  const [personCount, setPersonCount] = useState<number>(FULL_DEMO_COUNTS.personCount ?? 0);
  const [groupCount, setGroupCount] = useState<number>(FULL_DEMO_COUNTS.groupCount ?? 0);
  const [gatheringCount, setGatheringCount] = useState<number>(FULL_DEMO_COUNTS.gatheringCount ?? 0);
  const [taskCount, setTaskCount] = useState<number>(FULL_DEMO_COUNTS.taskCount ?? 0);
  const [activePreset, setActivePreset] = useState<string>("full");

  // Checkbox for clearing planner records before population
  const [clearBeforePopulate, setClearBeforePopulate] = useState<boolean>(true);
  const [generatorMode, setGeneratorMode] = useState<"standard" | "advanced">("standard");

  // Operation state
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<boolean>(false);
  const [confirmClearPlannerDialog, setConfirmClearPlannerDialog] = useState<boolean>(false);

  const applyPreset = (preset: PresetPackage) => {
    setActivePreset(preset.id);
    setPersonCount(preset.persons);
    setGroupCount(preset.groups);
    setGatheringCount(preset.gatherings);
    setTaskCount(preset.tasks);
  };

  const handleCustomChange = (setter: React.Dispatch<React.SetStateAction<number>>, value: number) => {
    setter(value);
    setActivePreset("custom");
  };

  const handlePopulate = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      const result: DatabaseAdminResult = await populateCustomMockData(
        {
          personCount,
          groupCount,
          gatheringCount,
          taskCount,
        },
        { clearPlannerFirst: clearBeforePopulate }
      );

      if (result.failures.length > 0) {
        showFeedback(`Fylling fullført med noen feil: ${result.failures[0].message}`, "error");
      } else {
        const clearedNote = clearBeforePopulate ? "Tidligere testdata ble ryddet. " : "";
        showFeedback(
          `${clearedNote}Databasen er fylt med ${personCount} personer, ${groupCount} grupper, ${gatheringCount} samlinger, ${taskCount} oppgaver og ${DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller.`
        );
      }
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "En feil oppstod under fylling av Firestore.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleQuickPopulateFull = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      setPersonCount(FULL_DEMO_COUNTS.personCount ?? 0);
      setGroupCount(FULL_DEMO_COUNTS.groupCount ?? 0);
      setGatheringCount(FULL_DEMO_COUNTS.gatheringCount ?? 0);
      setTaskCount(FULL_DEMO_COUNTS.taskCount ?? 0);
      setActivePreset("full");

      const result: DatabaseAdminResult = await populateCustomMockData(
        {
          personCount: FULL_DEMO_COUNTS.personCount,
          groupCount: FULL_DEMO_COUNTS.groupCount,
          gatheringCount: FULL_DEMO_COUNTS.gatheringCount,
          taskCount: FULL_DEMO_COUNTS.taskCount,
        },
        { clearPlannerFirst: clearBeforePopulate }
      );

      if (result.failures.length > 0) {
        showFeedback(`Fylling fullført med feil: ${result.failures[0].message}`, "error");
      } else {
        showFeedback(
          `Databasen er fylt med ${FULL_DEMO_COUNTS.personCount} personer, ${FULL_DEMO_COUNTS.groupCount} grupper, ${FULL_DEMO_COUNTS.gatheringCount} samlinger, ${FULL_DEMO_COUNTS.taskCount} oppgaver og ${DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller.`
        );
      }
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : `Kunne ikke fylle med ${FULL_DEMO_COUNTS.personCount} personer.`, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleClearPlannerOnly = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      const result = await clearPlannerTestData();
      if (result.failures.length > 0) {
        showFeedback(`Kunne ikke tømme alle samlinger: ${result.failures[0].message}`, "error");
      } else {
        showFeedback(
          `Testpersoner, grupper og planlegger-data er tømt (${result.total} dokumenter). Nettsiden og de offentlige arrangementene er bevart.`
        );
      }
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Kunne ikke tømme testdata.", "error");
    } finally {
      setIsWorking(false);
      setConfirmClearPlannerDialog(false);
    }
  };

  const handleRestoreFullMock = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      const result = await restoreFullMockDatabase();
      if (result.failures.length > 0) {
        showFeedback(`Gjenoppretting fullført med feil: ${result.failures[0].message}`, "error");
      } else {
        showFeedback(
          `Demo-planleggeren er lagt inn på nytt: ${FULL_DEMO_COUNTS.personCount} personer, ${FULL_DEMO_COUNTS.groupCount} grupper, samlinger, oppgaver og ${DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller. Sidene på nettsiden er ikke rørt.`
        );
      }
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Kunne ikke gjenopprette demo-data.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteAll = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      const result = await deleteAllData();
      if (result.failures.length > 0) {
        showFeedback(`Sletting fullført med noen feil: ${result.failures[0].message}`, "error");
      } else {
        showFeedback("Alle data i databasen er nå slettet.");
      }
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Kunne ikke slette database.", "error");
    } finally {
      setIsWorking(false);
      setConfirmDeleteDialog(false);
    }
  };


  const totalDocuments =
    allPersons.length +
    groups.length +
    gatherings.length +
    tasks.length +
    assignments.length +
    pages.length +
    news.length +
    sermons.length +
    staff.length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)] flex items-center gap-2.5">
            <Database className="w-6 h-6 text-[var(--studio-icon)]" />
            <span>Database og Testdata</span>
          </h2>
          <p className="text-xs text-[var(--studio-muted)] mt-1 max-w-2xl leading-relaxed">
            Administrer Firestore-databasen, fyll inn testdata for menigheten med egne glidebrytere eller ferdige pakker, og overvåk
            sanntidsstatus.
          </p>
        </div>

        {/* Live Firestore Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] shrink-0 self-start sm:self-auto">
          <span
            className={`w-2 h-2 rounded-full ${
              isFirestoreConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="text-xs font-semibold text-slate-200">
            {isFirestoreConnected ? "Firestore tilkoblet" : "Kobler til Firestore..."}
          </span>
        </div>
      </div>

      {/* Seksjon 1: Live Status og Tellere */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">
            Gjeldende innhold i databasen ({totalDocuments} dokumenter)
          </h3>
          <span className="text-[11px] text-[var(--studio-muted)]">Sanntidssynkronisert med Firestore</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--studio-accent-bg)] text-[var(--studio-icon)] shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--studio-text)] font-mono tabular-nums">{allPersons.length}</div>
              <div className="text-[11px] text-[var(--studio-muted)]">Personer</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-400 shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--studio-text)] font-mono tabular-nums">{groups.length}</div>
              <div className="text-[11px] text-[var(--studio-muted)]">Grupper</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--studio-text)] font-mono tabular-nums">{gatherings.length}</div>
              <div className="text-[11px] text-[var(--studio-muted)]">Samlinger</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-950/80 text-sky-400 shrink-0">
              <ListTodo className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--studio-text)] font-mono tabular-nums">{tasks.length}</div>
              <div className="text-[11px] text-[var(--studio-muted)]">Oppgaver</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-950/80 text-purple-400 shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--studio-text)] font-mono tabular-nums">{assignments.length}</div>
              <div className="text-[11px] text-[var(--studio-muted)]">Tildelinger</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-950/80 text-rose-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--studio-text)] font-mono tabular-nums">
                {pages.length + news.length + sermons.length + staff.length}
              </div>
              <div className="text-[11px] text-[var(--studio-muted)]">CMS & Innhold</div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo eller produksjon: i produksjon kan ingenting tømmes herfra */}
      <OperatingModePanel mode={operatingMode} showFeedback={showFeedback} />

      {/* Velg menighet: bytt nettsiden til en annen menighets, for demonstrasjon */}
      <ChurchPickerPanel mode={operatingMode} showFeedback={showFeedback} />

      {/* Datasett: last ned alt innholdet som én fil, eller hent inn en slik fil */}
      <DatasetPanel showFeedback={showFeedback} />

      {/* Emptying the group chats is ordinary upkeep, and is there also when the app is in production */}
      <ChatResetPanel showFeedback={showFeedback} />

      {/* Made-up data and the reset belong in a demo. Where the app is in production, or it is not known which it is, none of it is shown: one press must not put invented persons among the real ones. */}
      {deletionLocked ? (
        <p id="test-tools-hidden" className="text-xs text-[var(--studio-muted)]">
          Testdata og tilbakestilling vises ikke når appen står i produksjon.
        </p>
      ) : (
        <>
      {/* Seksjon 2: Populeringsvelger */}
      <section className="space-y-4">
        {/* Modus-velger */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--studio-border)] pb-3">
          <button
            type="button"
            onClick={() => setGeneratorMode("standard")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              generatorMode === "standard"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
          >
            Hurtiggenerator (Datatyper & slider 1-100)
          </button>
          <button
            type="button"
            onClick={() => setGeneratorMode("advanced")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              generatorMode === "advanced"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
          >
            Avansert planlegger-oppsett (Pakker & detaljglidere)
          </button>
        </div>

        {generatorMode === "standard" ? (
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)]">
            <DatabaseTestdataTab showFeedback={showFeedback} />
          </div>
        ) : (
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--studio-border)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generer og populer testdata</span>
                </h3>
                <p className="text-xs text-[var(--studio-muted)] mt-0.5">
                  Velg en ferdig pakke eller finjuster glidebryterne for nøyaktig antall personer, grupper, samlinger og oppgaver.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--studio-accent-text)] font-semibold bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] px-2.5 py-1 rounded-lg">
                  Maks oppsett: {FULL_DEMO_COUNTS.personCount} personer / {FULL_DEMO_COUNTS.groupCount} grupper
                </span>
              </div>
            </div>

        {/* 1. Pakkevelgere */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--studio-muted)]">Velg en forhåndsdefinert pakke:</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRESET_PACKAGES.map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-4 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? "bg-[var(--studio-accent-bg)] border-indigo-500 shadow-md ring-1 ring-indigo-500/50"
                      : "bg-[var(--studio-row)] border-[var(--studio-border)] hover:border-[var(--studio-border)] hover:bg-[var(--studio-bg)]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--studio-text)] text-sm">{preset.name}</span>
                      {isSelected ? (
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[var(--studio-muted)] bg-[var(--studio-surface)] px-1.5 py-0.5 rounded">
                          {preset.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--studio-muted)] leading-relaxed">{preset.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[var(--studio-border)] text-[11px] text-[var(--studio-muted)] font-mono flex items-center justify-between">
                    <span>{preset.persons} personer</span>
                    <span>{preset.groups} grupper</span>
                    <span>{preset.gatherings} samlinger</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Glidebrytere for finjustering */}
        <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span>Finjuster antall elementer for populering</span>
            </span>
            {activePreset === "custom" && (
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                Egendefinert oppsett
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
            {/* Personer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--studio-muted)] font-semibold">Personer:</span>
                <span className="font-mono font-bold text-[var(--studio-icon)] text-sm">{personCount} av {FULL_DEMO_COUNTS.personCount}</span>
              </div>
              <input
                type="range"
                min={4}
                max={FULL_DEMO_COUNTS.personCount}
                value={personCount}
                onChange={(e) => handleCustomChange(setPersonCount, Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--studio-muted)] font-mono">
                <span>4 (Minimum)</span>
                <span>16</span>
                <span>{FULL_DEMO_COUNTS.personCount} (Maks)</span>
              </div>
            </div>

            {/* Grupper */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--studio-muted)] font-semibold">Grupper & Husfellesskap:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{groupCount} av {FULL_DEMO_COUNTS.groupCount}</span>
              </div>
              <input
                type="range"
                min={2}
                max={FULL_DEMO_COUNTS.groupCount}
                value={groupCount}
                onChange={(e) => handleCustomChange(setGroupCount, Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--studio-muted)] font-mono">
                <span>2 (Kjerne)</span>
                <span>6</span>
                <span>{FULL_DEMO_COUNTS.groupCount} (Maks)</span>
              </div>
            </div>

            {/* Samlinger */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--studio-muted)] font-semibold">Samlinger & Gudstjenester:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{gatheringCount} av {FULL_DEMO_COUNTS.gatheringCount}</span>
              </div>
              <input
                type="range"
                min={2}
                max={FULL_DEMO_COUNTS.gatheringCount}
                value={gatheringCount}
                onChange={(e) => handleCustomChange(setGatheringCount, Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--studio-muted)] font-mono">
                <span>2</span>
                <span>10</span>
                <span>{FULL_DEMO_COUNTS.gatheringCount} (Maks)</span>
              </div>
            </div>

            {/* Oppgaver */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--studio-muted)] font-semibold">Bemanningsoppgaver:</span>
                <span className="font-mono font-bold text-sky-400 text-sm">{taskCount} av {FULL_DEMO_COUNTS.taskCount}</span>
              </div>
              <input
                type="range"
                min={2}
                max={FULL_DEMO_COUNTS.taskCount}
                value={taskCount}
                onChange={(e) => handleCustomChange(setTaskCount, Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--studio-muted)] font-mono">
                <span>2</span>
                <span>11</span>
                <span>{FULL_DEMO_COUNTS.taskCount} (Maks)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamisk oppsummering av hva som inkluderes */}
        <div className="p-3.5 rounded-xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] text-xs text-[var(--studio-muted)] space-y-1">
          <div className="font-bold text-[var(--studio-accent-text)] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
            <span>Hva inkluderes med {personCount} personer og {groupCount} grupper:</span>
          </div>
          <p className="text-[var(--studio-muted)] text-[11px] leading-relaxed">
            {personCount >= (FULL_DEMO_COUNTS.personCount ?? 0)
              ? "Alle 3 pastorer (Hovedpastor, Ungdomspastor, Barne- og familiepastor), hele menighetsrådet (7 personer), hele staben (diakon, musikk, teknikk), samtlige frivillige teamledere og 4 husfellesskap (Sentrum, Havna, Borkedalen, Ung Voksen)."
              : personCount >= 16
              ? "Pastorer, rådsmedlemmer, stabsmedlemmer (diakoni, musikk), frivillige teamledere (kaffe, lovsang, lyd) og husfellesskap."
              : personCount >= 8
              ? "Hovedpastor, daglig leder, menighetsrådsleder, ungdomspastor, barne- og familiepastor og sentrale nøkkelpersoner."
              : "Hovedpastor Kari Nordmann, daglig leder Ola Hansen, barneleder Ingrid Berg og menighetsrådsleder Jonas Lie."}
          </p>
        </div>

        {/* 3. Avkrysningsboks for selektiv tømming før populering */}
        <div className="p-3.5 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] flex items-start gap-3">
          <input
            id="clear-before-populate-checkbox"
            type="checkbox"
            checked={clearBeforePopulate}
            onChange={(e) => setClearBeforePopulate(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[var(--studio-border)] bg-[var(--studio-surface)] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer accent-indigo-600"
          />
          <label htmlFor="clear-before-populate-checkbox" className="text-xs space-y-0.5 cursor-pointer">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <span>Tøm eksisterende testpersoner og planleggerdata før fylling</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.2 rounded">
                Standard / Anbefalt
              </span>
            </div>
            <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
              Fjerner tidligere testpersoner, grupper, interne samlinger og oppgaver i planleggeren før nye data legges inn, slik at databasen forblir ren og fri for duplikater.
              <span className="text-emerald-300 font-medium ml-1">
                Sider, nyheter, taler og innstillinger blir stående, og det gjør også offentlige arrangementer som er
                hentet inn med et datasett.
              </span>
            </p>
          </label>
        </div>

        {/* Hovedhandlinger for populering */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[var(--studio-muted)]">
            {clearBeforePopulate ? (
              <span className="text-amber-300/90 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Tømmer eksisterende planleggerdata før fylling
              </span>
            ) : (
              <span className="text-[var(--studio-muted)]">
                Overskriver eksisterende dokumenter med samme ID (uten sletting)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Hurtigknapp: hele demosettet */}
            <button
              type="button"
              onClick={handleQuickPopulateFull}
              disabled={isWorking}
              className="px-4 py-2.5 rounded-xl bg-[var(--studio-accent-bg)] hover:bg-indigo-900/80 border border-indigo-700/70 text-[var(--studio-accent-text)] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Populer {FULL_DEMO_COUNTS.personCount} testpersoner</span>
            </button>

            {/* Hovedknapp med valgte glidebryter-verdier */}
            <button
              type="button"
              onClick={handlePopulate}
              disabled={isWorking}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              {isWorking ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <RefreshCw className="w-4 h-4 text-white" />
              )}
              <span>
                {isWorking
                  ? "Skriver til Firestore..."
                  : `Populer databasen (${personCount} personer, ${groupCount} grupper)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    )}
  </section>

      {/* Simulert historikk for Analysebord: only while the board it is made for is turned on */}
      {isAddonOn(addons, "analysebord") && <SimulationPanel showFeedback={showFeedback} />}

      {/* Seksjon 5: Administrasjon & Sletting av testdata (Farefelt) */}
      <section className="p-5 sm:p-6 rounded-2xl bg-red-950/20 border border-red-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-900/30 pb-3">
          <div>
            <h3 className="text-base font-bold text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Tilbakestilling & Sletting</span>
            </h3>
            <p className="text-xs text-red-300/80 mt-0.5">
              Tøm kun testpersoner og planlegger-data, legg demo-innholdet inn på nytt, eller slett alt i databasen.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-red-300 bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded self-start sm:self-auto">
            {totalDocuments} dokumenter i Firestore
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Valg 1: Tøm kun testdata */}
          <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <span className="font-bold text-[var(--studio-text)] text-xs flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Tøm kun testdata (Personer & Planlegger)</span>
              </span>
              <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
                Fjerner alle testpersoner, grupper, interne samlinger, demo-samlinger og oppgaver.{" "}
                <strong className="text-emerald-400 font-semibold">
                  Nettsiden og offentlige arrangementer som er hentet inn, blir stående.
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmClearPlannerDialog(true)}
              disabled={isWorking || deletionLocked}
              title={deletionLocked ? "Appen står i produksjon. Sett den i demo under Driftsmodus først." : undefined}
              className="px-3.5 py-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Tøm planlegger-testdata</span>
            </button>
          </div>

          {/* Valg 2: Gjenopprett demo-data */}
          <div className="p-4 rounded-xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <span className="font-bold text-indigo-100 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--studio-accent-text)]" />
                <span>Legg inn demo-planleggeren på nytt</span>
              </span>
              <p className="text-[11px] text-[var(--studio-accent-text)]/80 leading-relaxed">
                Fyller planleggeren med {FULL_DEMO_COUNTS.personCount} personer, grupper, demo-samlinger, oppgaver og alle{" "}
                {DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller fra rollebiblioteket. Sidene, nyhetene og talene på
                nettsiden røres ikke. Demo-nettsiden velges under «Velg menighet».
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestoreFullMock}
              disabled={isWorking}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start"
            >
              {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Fyll planleggeren på nytt</span>
            </button>
          </div>

          

          {/* Valg 3: Komplett sletting av alt */}
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <span className="font-bold text-red-200 text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Total tilbakestilling av alle samlinger</span>
              </span>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                Permanent sletting av samtlige dokumenter (også CMS-sider og artikler). Krever ekstra bekreftelse.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDeleteDialog(true)}
              disabled={isWorking || deletionLocked}
              title={deletionLocked ? "Appen står i produksjon. Sett den i demo under Driftsmodus først." : undefined}
              className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Slett alt i databasen</span>
            </button>
          </div>
        </div>
      </section>

        </>
      )}

      {/* Bekreftelsesdialog for tømming av kun planlegger-data */}
      {confirmClearPlannerDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-overlay)] backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--studio-bg)] border border-amber-800/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[var(--studio-text)]">Tømme testpersoner og planleggerdata?</h4>
                <p className="text-xs text-amber-300">Nettsiden og offentlige arrangementer bevares.</p>
              </div>
            </div>

            <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
              Dette sletter personene ({allPersons.length}), gruppene, de interne samlingene, demo-samlingene og oppgavene ({tasks.length}), med meldinger og oppmøte. Sider, nyheter, taler og innstillinger blir stående. Det gjør også offentlige arrangementer som er hentet inn med et datasett, og kalendergruppen som eier dem.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClearPlannerDialog(false)}
                disabled={isWorking}
                className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-xs font-semibold cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleClearPlannerOnly}
                disabled={isWorking}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isWorking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isWorking ? "Tømmer..." : "Ja, tøm testdata"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bekreftelsesdialog for full sletting */}
      {confirmDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-overlay)] backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--studio-bg)] border border-red-800/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[var(--studio-text)]">Slette absolutt alle data i databasen?</h4>
                <p className="text-xs text-red-300">Dette kan ikke angres.</p>
              </div>
            </div>

            <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
              Dette vil permanent slette <strong>{totalDocuments} dokumenter</strong> fra Firestore for alle brukere
              (personer, grupper, samlinger, oppgaver, meldinger og CMS-innhold som sider og nyheter).
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteDialog(false)}
                disabled={isWorking}
                className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-xs font-semibold cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isWorking}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isWorking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isWorking ? "Sletter alt..." : "Ja, slett alt permanent"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
