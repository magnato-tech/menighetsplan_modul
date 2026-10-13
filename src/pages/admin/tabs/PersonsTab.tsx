import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Shield,
  CalendarX,
  Database,
  LayoutGrid,
  Loader2,
  Search,
  Sparkles,
  Table2,
  UserPlus,
} from "lucide-react";
import { StudioData, ShowFeedback } from "../studio";
import { populateDemoPersons } from "../../../services/databaseAdmin";
import {
  matchesPersonSearch,
  nextSort,
  PersonSortKey,
  SortDirection,
  sortPersonRows,
} from "../../../utils/personDirectory";
import { PersonsTable } from "./persons/PersonsTable";
import { studioSecondaryButton } from "../studioTheme";
import { birthDateError, todayInNorway } from "../../../utils/birthDate";
import { emailError, membershipValue, personEntryError, sharedEmailWarnings } from "../../../utils/personForm";
import { personListFile } from "../../../utils/personListFile";
import { createPersonInGroup } from "../../../services/memberProposals";
import { reportWriteError } from "../../../services/writeErrors";

interface PersonsTabProps {
  studio: StudioData;
  showFeedback?: ShowFeedback;
}

export const PersonsTab: React.FC<PersonsTabProps> = ({ studio, showFeedback }) => {
  const { adminPersons, adminGroups, addPerson } = studio;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newCongregation, setNewCongregation] = useState(false);
  const [newDenomination, setNewDenomination] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");
  const [onlyCongregation, setOnlyCongregation] = useState(false);
  const [onlyDenomination, setOnlyDenomination] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isPopulating, setIsPopulating] = useState<boolean>(false);
  const [view, setView] = useState<"cards" | "table">("table");
  const [sortKey, setSortKey] = useState<PersonSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handlePopulateTestData = async () => {
    if (isPopulating) return;
    setIsPopulating(true);
    try {
      const result = await populateDemoPersons();
      if (result.failures.length > 0) {
        showFeedback?.(`Fylling fullført med noen feil: ${result.failures[0].message}`, "error");
      } else {
        showFeedback?.("Databasen er nå fylt med 32 personer for stab, lederskap, pastorer og grupper!");
      }
    } catch (err) {
      showFeedback?.(err instanceof Error ? err.message : "Kunne ikke fylle testdata", "error");
    } finally {
      setIsPopulating(false);
    }
  };

  const sharedEmails = useMemo(
    () => sharedEmailWarnings(adminPersons.map((row) => row.person)),
    [adminPersons]
  );

  const visiblePersons = useMemo(() => {
    const filtered = adminPersons.filter((row) => {
      if (!matchesPersonSearch(row, searchTerm)) return false;
      if (onlyCongregation && row.person.congregationMember !== true) return false;
      if (onlyDenomination && row.person.denominationMember !== true) return false;
      return true;
    });
    return sortPersonRows(filtered, sortKey, sortDirection);
  }, [adminPersons, searchTerm, sortKey, sortDirection, onlyCongregation, onlyDenomination]);

  const handleCreatePerson = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) {
      showFeedback?.("Personen må ha et navn", "error");
      return;
    }
    const wrong = personEntryError({ name: newName, email: newEmail, birthDate: newBirthDate });
    if (wrong) {
      showFeedback?.(wrong, "error");
      return;
    }
    const input = {
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      birthDate: newBirthDate || undefined,
      congregationMember: membershipValue(newCongregation),
      denominationMember: membershipValue(newDenomination),
    };
    const done = () => {
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewBirthDate("");
      setNewCongregation(false);
      setNewDenomination(false);
      setNewGroupId("");
      setCreating(false);
      showFeedback?.(`${input.name} er lagt inn i registeret.`);
    };
    if (newGroupId) {
      createPersonInGroup(input, newGroupId).then(done).catch((error) => reportWriteError("legge inn personen", error));
      return;
    }
    if (addPerson(input).success) done();
  };

  const downloadList = () => {
    const file = personListFile(visiblePersons.map((row) => row.person));
    const url = URL.createObjectURL(new Blob([file], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "personer.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: PersonSortKey) => {
    const next = nextSort(sortKey, sortDirection, key);
    setSortKey(next.key);
    setSortDirection(next.direction);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)] flex items-center gap-2">
            <span>Personregister</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--studio-surface)] text-[var(--studio-muted)] font-normal">
              {adminPersons.length} personer
            </span>
          </h2>
          <p className="text-xs text-[var(--studio-muted)] mt-1">
            Administrer kontaktinfo, tilganger og fravær for frivillige og ledere.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          className="px-3.5 py-2 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{creating ? "Lukk skjema" : "Ny person"}</span>
        </button>
        <button
          type="button"
          onClick={handlePopulateTestData}
          disabled={isPopulating}
          className="px-3.5 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          title="Fyller databasen i Firebase med 32 personer (pastorer, lederskap, stab og frivillige)"
        >
          {isPopulating ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Database className="w-4 h-4 text-[var(--studio-accent-text)]" />
          )}
          <span>{isPopulating ? "Fyller testdata..." : "Populer testdata (32 personer)"}</span>
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreatePerson} className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
            Navn
            <input
              id="input-new-person-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-normal"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
            E-post
            <input
              id="input-new-person-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-normal"
            />
            {emailError(newEmail) && <span className="block font-normal text-red-700">{emailError(newEmail)}</span>}
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
            Telefon
            <input
              id="input-new-person-phone"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-normal"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
            Fødselsdato
            <input
              id="input-new-person-birthdate"
              type="date"
              value={newBirthDate}
              max={todayInNorway()}
              onChange={(event) => setNewBirthDate(event.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-normal"
            />
            {birthDateError(newBirthDate) ? (
              <span className="block font-normal text-red-700">{birthDateError(newBirthDate)}</span>
            ) : (
              <span className="block font-normal text-[var(--studio-muted)]">Valgfritt. Vises ikke på nettsiden.</span>
            )}
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-[var(--studio-text)]">
            <input id="check-new-congregation" type="checkbox" checked={newCongregation} onChange={(event) => setNewCongregation(event.target.checked)} />
            Medlem i menigheten
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-[var(--studio-text)]">
            <input id="check-new-denomination" type="checkbox" checked={newDenomination} onChange={(event) => setNewDenomination(event.target.checked)} />
            Medlem i kirkesamfunnet
          </label>
          <label className="sm:col-span-2 space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
            Legg i gruppe
            <select
              id="select-new-person-group"
              value={newGroupId}
              onChange={(event) => setNewGroupId(event.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-normal"
            >
              <option value="">Ikke legg i en gruppe</option>
              {adminGroups.map((row) => (
                <option key={row.group.id} value={row.group.id}>
                  {row.group.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
              Legg inn
            </button>
          </div>
        </form>
      )}

      {adminPersons.length < 5 && (
        <div className="p-4 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-[var(--studio-icon)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[var(--studio-text)]">Få et fyldig testmiljø med 32 personer</p>
              <p className="text-[var(--studio-muted)]">
                Fyll automatisk inn et komplett register med pastorer, menighetsråd, lovsangsteam, teknikere, barnekirkeledere og frivillige.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePopulateTestData}
            disabled={isPopulating}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shrink-0 shadow-sm cursor-pointer"
          >
            {isPopulating ? "Fyller data..." : "Fyll inn 32 personer nå"}
          </button>
        </div>
      )}

      {sharedEmails.length > 0 && (
        <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 text-xs space-y-2">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Flere personer har samme e-postadresse. Ingen av dem kan logge inn.
          </p>
          <ul className="space-y-1">
            {sharedEmails.map((row) => (
              <li key={row.address}>
                <span className="font-semibold">{row.address}</span>
                {": "}
                {row.names.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--studio-text)]">
        <label className="flex items-center gap-2">
          <input id="filter-congregation" type="checkbox" checked={onlyCongregation} onChange={(event) => setOnlyCongregation(event.target.checked)} />
          Medlem i menigheten
        </label>
        <label className="flex items-center gap-2">
          <input id="filter-denomination" type="checkbox" checked={onlyDenomination} onChange={(event) => setOnlyDenomination(event.target.checked)} />
          Medlem i kirkesamfunnet
        </label>
        <button type="button" id="btn-download-persons" onClick={downloadList} className="font-bold text-indigo-700 cursor-pointer">
          Last ned listen
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--studio-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Søk etter navn, gruppe, tilgang eller kontaktinfo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs placeholder:text-[var(--studio-muted)] focus:outline-hidden focus:border-indigo-500"
          />
        </div>
        <div className="inline-flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5 self-start">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
              view === "cards" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
            aria-pressed={view === "cards"}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kort
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
              view === "table" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
            aria-pressed={view === "table"}
          >
            <Table2 className="w-3.5 h-3.5" />
            Tabell
          </button>
        </div>
      </div>

      {visiblePersons.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)] text-center py-8">Ingen personer matcher søket.</p>
      ) : view === "table" ? (
        <PersonsTable
          rows={visiblePersons}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      ) : (
        <div className="space-y-3">
          {visiblePersons.map(({ person }) => {
            const isAdminRole = person.globalRole === "admin";
            const hasPoliceCert = Boolean(person.policeCertificateValidUntil);
            const unavailableCount = person.unavailablePeriods?.length || 0;

            return (
              <div
                key={person.id}
                className="p-4 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[var(--studio-text)] text-base">{person.name}</h3>
                    {isAdminRole ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
                        Administrator
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--studio-bg)] text-[var(--studio-accent-text)]">
                        Frivillig
                      </span>
                    )}

                    {hasPoliceCert ? (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <Shield className="w-3 h-3 text-emerald-400" />
                        Politiattest OK
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--studio-muted)] bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-0.5 rounded flex items-center gap-1">
                        <Shield className="w-3 h-3 text-[var(--studio-muted)]" />
                        Ingen attest
                      </span>
                    )}

                    {unavailableCount > 0 && (
                      <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <CalendarX className="w-3 h-3 text-amber-400" />
                        {unavailableCount} fraværsperiode(r)
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--studio-muted)] flex flex-wrap gap-4">
                    {person.phone && <span>Tlf: {person.phone}</span>}
                    {person.email && <span>E-post: {person.email}</span>}
                  </div>
                </div>

                <Link
                  to={`/admin/person/${person.id}`}
                  className={`${studioSecondaryButton} shrink-0`}
                >
                  Rediger person & fravær
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
