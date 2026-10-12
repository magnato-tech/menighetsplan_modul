import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  CalendarX,
  Database,
  LayoutGrid,
  Loader2,
  Search,
  Sparkles,
  Table2,
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
import { loginIdOf, sharedAddresses } from "../../../utils/logins";
import { AlertTriangle } from "lucide-react";

interface PersonsTabProps {
  studio: StudioData;
  showFeedback?: ShowFeedback;
}

export const PersonsTab: React.FC<PersonsTabProps> = ({ studio, showFeedback }) => {
  const { adminPersons } = studio;
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

  const sharedEmails = useMemo(() => {
    const addresses = sharedAddresses(adminPersons.map((row) => row.person));
    return addresses.map((address) => ({
      address,
      names: adminPersons.filter((row) => loginIdOf(row.person.email) === address).map((row) => row.person.name),
    }));
  }, [adminPersons]);

  const visiblePersons = useMemo(() => {
    const filtered = adminPersons.filter((row) => matchesPersonSearch(row, searchTerm));
    return sortPersonRows(filtered, sortKey, sortDirection);
  }, [adminPersons, searchTerm, sortKey, sortDirection]);

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
            Administrer kontaktinfo, tilganger og fravær for medlemmer og ledere.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePopulateTestData}
          disabled={isPopulating}
          className="px-3.5 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          title="Fyller databasen i Firebase med 32 personer (pastorer, lederskap, stab, frivillige og medlemmer)"
        >
          {isPopulating ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Database className="w-4 h-4 text-[var(--studio-accent-text)]" />
          )}
          <span>{isPopulating ? "Fyller testdata..." : "Populer testdata (32 personer)"}</span>
        </button>
      </div>

      {adminPersons.length < 5 && (
        <div className="p-4 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-[var(--studio-icon)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[var(--studio-text)]">Få et fyldig testmiljø med 32 personer</p>
              <p className="text-[var(--studio-muted)]">
                Fyll automatisk inn et komplett register med pastorer, menighetsråd, lovsangsteam, teknikere, barnekirkeledere og medlemmer.
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
                        Medlem
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
