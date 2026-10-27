import React, { useState } from "react";
import {
  generateTestdata,
  clearPlannerTestData,
  clearTestdata,
  deletePersonsTestdata,
  deleteGroupsTestdata,
  deleteRolesTestdata,
  type TestdataServiceResult,
} from "../../services/testdataService";
import { DEFAULT_VOLUNTEER_ROLE_NAMES } from "../../data/defaultVolunteerRoles";
import { FULL_DEMO_COUNTS } from "../../data/mockDocuments";
import { useFirebase } from "../../context/FirebaseDataContext";
import {
  Database,
  Users,
  FolderKanban,
  Shield,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Trash2,
} from "lucide-react";

export interface DatabaseTestdataTabProps {
  showFeedback?: (message: string, type?: "success" | "error") => void;
  className?: string;
}

export const DatabaseTestdataTab: React.FC<DatabaseTestdataTabProps> = ({
  showFeedback,
  className = "",
}) => {
  const { isFirestoreConnected, allPersons, groups } = useFirebase();

  // 1. Tre kontrollere med glidebrytere (0-100) for 'Personer', 'Grupper' og 'Roller'
  const [personCount, setPersonCount] = useState<number>(FULL_DEMO_COUNTS.personCount ?? 0);
  const [groupCount, setGroupCount] = useState<number>(FULL_DEMO_COUNTS.groupCount ?? 0);
  const [roleCount, setRoleCount] = useState<number>(FULL_DEMO_COUNTS.roleCount ?? 0);

  // 2. En avkrysningsboks for 'Tøm eksisterende testdata' (standard valgt)
  const [clearExistingData, setClearExistingData] = useState<boolean>(true);

  // Demo-samlingene med oppgaver er et eget valg, og står av: har menigheten hentet inn sine egne
  // arrangementer, skal ikke demo-gudstjenester blande seg inn i kalenderen på nettsiden.
  const [withGatherings, setWithGatherings] = useState<boolean>(false);

  // Operasjonstilstand
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // 3. 'Populer database'-funksjon mot Firebase via testdataService
  const handlePopulate = async () => {
    if (isWorking) return;
    setIsWorking(true);
    setActiveAction("populate");
    setStatusMessage(null);

    try {
      // Nullstill eksisterende data i Firestore hvis avkrysset
      if (clearExistingData) {
        await clearPlannerTestData();
      }

      // Trigger Firebase Firestore-skriving: genererer testpersoner med varierende tilhørighet og roller
      const result: TestdataServiceResult = await generateTestdata({
        personCount: Math.max(FULL_DEMO_COUNTS.personCount ?? 0, personCount),
        groupCount: groupCount > 0 ? groupCount : FULL_DEMO_COUNTS.groupCount ?? 0,
        roleCount: roleCount > 0 ? roleCount : FULL_DEMO_COUNTS.roleCount ?? 0,
        ...(withGatherings ? { gatheringCount: FULL_DEMO_COUNTS.gatheringCount, taskCount: FULL_DEMO_COUNTS.taskCount } : {}),
      });

      if (result.failures.length > 0) {
        const errorText = `Populering fullført med feil: ${result.failures[0].message}`;
        setStatusMessage({ text: errorText, type: "error" });
        showFeedback?.(errorText, "error");
      } else {
        const resetNote = clearExistingData ? "Tidligere testdata ble ryddet bort. " : "";
        const successText = withGatherings
          ? `${resetNote}Testdata er lagt inn: personer, grupper, demo-samlinger med oppgaver og ${DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller. Sidene, nyhetene, talene og innstillingene på nettsiden er ikke rørt.`
          : `${resetNote}Testdata er lagt inn: personer, grupper og ${DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller. Nettsiden og de offentlige arrangementene er ikke rørt.`;
        setStatusMessage({ text: successText, type: "success" });
        showFeedback?.(successText, "success");
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "En feil oppstod under skriving til Firestore.";
      setStatusMessage({ text: errorMsg, type: "error" });
      showFeedback?.(errorMsg, "error");
    } finally {
      setIsWorking(false);
      setActiveAction(null);
    }
  };

  // Målrettet sletting via testdataService
  const handleSelectiveDelete = async (
    type: "persons" | "groups" | "roles" | "all"
  ) => {
    if (isWorking) return;
    setIsWorking(true);
    setActiveAction(`delete-${type}`);
    setStatusMessage(null);

    try {
      let result: TestdataServiceResult;
      let label = "";

      if (type === "persons") {
        result = await deletePersonsTestdata();
        label = "Testpersoner og tildelinger";
      } else if (type === "groups") {
        result = await deleteGroupsTestdata();
        label = "Grupper, interne samlinger og oppgaver";
      } else if (type === "roles") {
        result = await deleteRolesTestdata();
        label = "Roller og oppgavetildelinger";
      } else {
        result = await clearTestdata();
        label = "Alle planlegger-testdata";
      }

      if (result.failures.length > 0) {
        const err = `Sletting av ${label.toLowerCase()} feilet: ${result.failures[0].message}`;
        setStatusMessage({ text: err, type: "error" });
        showFeedback?.(err, "error");
      } else {
        const success = `${label} ble slettet (${result.total} dokumenter). Nettsiden og de offentlige arrangementene er bevart.`;
        setStatusMessage({ text: success, type: "success" });
        showFeedback?.(success, "success");
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Feil ved sletting i Firestore.";
      setStatusMessage({ text: errorMsg, type: "error" });
      showFeedback?.(errorMsg, "error");
    } finally {
      setIsWorking(false);
      setActiveAction(null);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Toppseksjon med status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Database className="w-5 h-5 text-indigo-400" />
            <span>Database & Testdata</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Fyll planleggeren med testpersoner fordelt på grupper og lederroller. Nettsiden (sider, nyheter, taler, stab,
            innstillinger og offentlige arrangementer) røres ikke herfra.
          </p>
        </div>

        {/* Live Firestore-tilkobling */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shrink-0 self-start sm:self-auto text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isFirestoreConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="font-semibold text-slate-200">
            {isFirestoreConnected ? "Firestore tilkoblet" : "Kobler til Firestore..."}
          </span>
          <span className="text-slate-400 ml-1">
            ({allPersons.length} personer, {groups.length} grupper)
          </span>
        </div>
      </div>

      {/* 1. Tre kontrollere med glidebrytere (0-100) for 'Personer', 'Grupper' og 'Roller' */}
      <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Glidebrytere for testdata (0–100)</span>
          </span>
          <span className="text-xs font-mono text-indigo-300 font-semibold bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 rounded">
            {personCount} personer · {groupCount} grupper · {DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller
          </span>
        </div>

        <div className="space-y-6 pt-1">
          {/* Kontroller 1: Personer (0-100) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="personer-slider"
                className="font-bold text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Personer</span>
              </label>
              <span className="font-mono font-bold text-indigo-400 text-sm bg-indigo-950/80 border border-indigo-850 px-2.5 py-0.5 rounded-lg">
                {personCount} av 100
              </span>
            </div>
            <input
              id="personer-slider"
              type="range"
              min={0}
              max={100}
              value={personCount}
              onChange={(e) => setPersonCount(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 (Ingen)</span>
              <span className="text-indigo-400 font-semibold">{FULL_DEMO_COUNTS.personCount} (Fullt testsett)</span>
              <span>50</span>
              <span>100 (Maks)</span>
            </div>
          </div>

          {/* Kontroller 2: Grupper (0-100) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="grupper-slider"
                className="font-bold text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <FolderKanban className="w-4 h-4 text-emerald-400" />
                <span>Grupper</span>
              </label>
              <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-950/80 border border-emerald-850 px-2.5 py-0.5 rounded-lg">
                {groupCount} av 100
              </span>
            </div>
            <input
              id="grupper-slider"
              type="range"
              min={0}
              max={100}
              value={groupCount}
              onChange={(e) => setGroupCount(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 (Ingen)</span>
              <span className="text-emerald-400 font-semibold">{FULL_DEMO_COUNTS.groupCount} (Team & husfellesskap)</span>
              <span>50</span>
              <span>100 (Maks)</span>
            </div>
          </div>

          {/* Kontroller 3: Stabroller på personer (0-100) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="roller-slider"
                className="font-bold text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Stabroller (personer)</span>
              </label>
              <span className="font-mono font-bold text-purple-400 text-sm bg-purple-950/80 border border-purple-850 px-2.5 py-0.5 rounded-lg">
                {roleCount} av 100
              </span>
            </div>
            <input
              id="roller-slider"
              type="range"
              min={0}
              max={100}
              value={roleCount}
              onChange={(e) => setRoleCount(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 (Ingen)</span>
              <span className="text-purple-400 font-semibold">{FULL_DEMO_COUNTS.roleCount} (Pastorer, råd & stab)</span>
              <span>50</span>
              <span>100 (Maks)</span>
            </div>
            <p className="text-[10px] text-indigo-300/90">
              Alle {DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller (Lyd, Kjøkken, Taler …) følger alltid med i
              rollebiblioteket. De kobles til oppgaver når demo-samlingene tas med.
            </p>
          </div>
        </div>
      </div>

      {/* 2. En avkrysningsboks for 'Tøm eksisterende testdata' (standard valgt) */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-start gap-3 shadow-xs">
        <input
          id="tom-eksisterende-testdata"
          type="checkbox"
          checked={clearExistingData}
          onChange={(e) => setClearExistingData(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer accent-indigo-600"
        />
        <label htmlFor="tom-eksisterende-testdata" className="text-xs space-y-0.5 cursor-pointer">
          <div className="font-bold text-slate-200 flex items-center gap-2">
            <span>Tøm eksisterende testdata</span>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.2 rounded">
              Standard valgt
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Sletter personer, grupper, interne samlinger, oppgaver, meldinger og oppmøte før ny fylling, så planleggeren
            ikke får dobbelt opp.
            <span className="text-emerald-400 font-medium ml-1">
              Sider, nyheter, taler og innstillinger blir stående, og det gjør også offentlige arrangementer som er
              hentet inn med et datasett.
            </span>
          </p>
        </label>
      </div>

      {/* Demo-samlinger er et eget valg (standard av) */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-start gap-3 shadow-xs">
        <input
          id="ta-med-demo-samlinger"
          type="checkbox"
          checked={withGatherings}
          onChange={(e) => setWithGatherings(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer accent-indigo-600"
        />
        <label htmlFor="ta-med-demo-samlinger" className="text-xs space-y-0.5 cursor-pointer">
          <div className="font-bold text-slate-200">Ta med demo-samlinger og oppgaver</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Legger også inn {FULL_DEMO_COUNTS.gatheringCount} demo-samlinger med oppgaver, tildelinger og oppmøte, blant dem gudstjenester annenhver søndag med hele programmet fra malen. Demo-gudstjenestene vises da i
            kalenderen på nettsiden, sammen med arrangementene som ligger der fra før. La valget stå av når nettsiden har
            menighetens egne arrangementer.
          </p>
        </label>
      </div>

      {/* Status-melding ved handling */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-700/80 text-emerald-200"
              : "bg-red-950/60 border-red-700/80 text-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 3. Stor 'Populer database' knapp */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handlePopulate}
          disabled={isWorking}
          className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-indigo-500/20 transition-all cursor-pointer"
        >
          {isWorking && activeAction === "populate" ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <RefreshCw className="w-5 h-5 text-white" />
          )}
          <span>
            {isWorking && activeAction === "populate"
              ? "Legger inn testdata…"
              : "Populer database"}
          </span>
        </button>

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
          <span>
            {clearExistingData ? (
              <span className="text-amber-400/90 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                Nullstiller eksisterende testdata før fylling
              </span>
            ) : (
              "Overskriver eksisterende data uten forhåndssletting"
            )}
          </span>
          <span className="text-slate-400">
            Inkluderer {DEFAULT_VOLUNTEER_ROLE_NAMES.length} tjenesteroller{withGatherings ? ` og ${FULL_DEMO_COUNTS.gatheringCount} demo-samlinger` : ""}
          </span>
        </div>
      </div>

      {/* Seksjon for selektiv tømming via testdataService */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Målrettet sletting av testdata</span>
          </span>
          <span className="text-[10px] text-slate-400">Nettsiden og offentlige arrangementer bevares alltid</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            disabled={isWorking}
            onClick={() => handleSelectiveDelete("persons")}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isWorking && activeAction === "delete-persons" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Users className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>Slett kun personer</span>
          </button>
          <button
            type="button"
            disabled={isWorking}
            onClick={() => handleSelectiveDelete("groups")}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isWorking && activeAction === "delete-groups" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Slett kun grupper</span>
          </button>
          <button
            type="button"
            disabled={isWorking}
            onClick={() => handleSelectiveDelete("roles")}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isWorking && activeAction === "delete-roles" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>Slett roller & oppgaver</span>
          </button>
        </div>
      </div>
    </div>
  );
};
