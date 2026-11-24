import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Shield,
  CalendarX,
  Database,
  FileUp,
  LayoutGrid,
  Loader2,
  Search,
  Sparkles,
  Table2,
  UserPlus,
} from "lucide-react";
import { StudioData, ShowFeedback, studioTabUrl } from "../studio";
import { populateDemoPersons } from "../../../services/databaseAdmin";
import {
  isInServiceGroup,
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
import { DEMO } from "../../../demo";
import { clerkOnlyInAdmin } from "../../../utils/session";
import { useOperatingMode } from "../../../hooks/useOperatingMode";
import { CornerstoneImportDialog } from "../CornerstoneImportDialog";
import { FilterMenu } from "./persons/FilterMenu";
import { SaveListDialog } from "./persons/SaveListDialog";
import { CATEGORY_ORDER, ROLE_LABEL, ROLE_ORDER, categoryLabel, cleanFilter, describeFilter, isEmptyFilter, personsMatching, type PersonFilter } from "../../../utils/personFilter";
import { listFailureText, writeEmailHandover, type EmailList, type EmailListKind } from "../../../utils/emailLists";
import { saveEmailList } from "../../../services/emailLists";
import { useEmailLists } from "../../../hooks/useEmailLists";
import { newId } from "../../../utils/id";

const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABEL[role] }));
const CATEGORY_OPTIONS = CATEGORY_ORDER.map((category) => ({ value: category, label: categoryLabel(category) }));

interface PersonsTabProps {
  studio: StudioData;
  showFeedback?: ShowFeedback;
}

export const PersonsTab: React.FC<PersonsTabProps> = ({ studio, showFeedback }) => {
  const { adminPersons, adminGroups, addPerson, currentUser } = studio;
  const clerkOnly = clerkOnlyInAdmin(currentUser ?? { globalRole: "member" });
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newCongregation, setNewCongregation] = useState(false);
  const [newDenomination, setNewDenomination] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");
  // What the table is narrowed to: the checkboxes, the role, the type and the group (see utils/personFilter.ts)
  const [filter, setFilter] = useState<PersonFilter>({});
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isPopulating, setIsPopulating] = useState<boolean>(false);
  const [view, setView] = useState<"cards" | "table">("table");
  const [sortKey, setSortKey] = useState<PersonSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Made-up persons belong in a demo. Where the app is in production, or it is not known which it
  // is, they are not offered: a real register must never be filled with them.
  const testDataAllowed = useOperatingMode() === "demo";
  const handlePopulateTestData = async () => {
    if (isPopulating || !testDataAllowed) return;
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

  // The lists are read for the name check and for the lists in «Send e-post»; the clerk does not see e-mail
  const listsState = useEmailLists(!clerkOnly);
  const persons = useMemo(() => adminPersons.map((row) => row.person), [adminPersons]);
  const groups = useMemo(() => adminGroups.map((row) => row.group), [adminGroups]);
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name, "nb")), [groups]);
  // The table reads the service groups from the rows it shows (the same reckoning as the cards), so
  // «Ikke i noen tjenestegruppe» is asked of those rows; the rest of the filter is matched by personsMatching
  const matchingIds = useMemo(
    () => new Set(personsMatching(persons, groups, { ...filter, withoutService: undefined }).map((person) => person.id)),
    [persons, groups, filter]
  );

  const visiblePersons = useMemo(() => {
    const filtered = adminPersons.filter((row) => matchingIds.has(row.person.id) && (!filter.withoutService || !isInServiceGroup(row)) && matchesPersonSearch(row, searchTerm));
    return sortPersonRows(filtered, sortKey, sortDirection);
  }, [adminPersons, matchingIds, filter.withoutService, searchTerm, sortKey, sortDirection]);

  const searching = searchTerm.trim() !== "";
  const narrowed = !isEmptyFilter(filter) || searching;
  const filterText = describeFilter(filter, groups);
  const headerText = [filterText, searching ? `søk «${searchTerm.trim()}»` : ""].filter(Boolean).join(" · ");
  // The name the chip in «Send e-post» is given: the filter, or «Utvalg fra Personer» when a search is typed (a search is not kept)
  const selectionLabel = searching ? "Utvalg fra Personer" : `Utvalg: ${filterText}`;

  const setFlag = (key: "congregationMember" | "denominationMember" | "withoutService", on: boolean) =>
    setFilter((current) => ({ ...current, [key]: on ? true : undefined }) as PersonFilter);

  /** «Send e-post til utvalget»: the persons shown are handed to «Send e-post», which opens with them as a chip. */
  const sendSelection = () => {
    if (!writeEmailHandover({ personIds: visiblePersons.map((row) => row.person.id), label: selectionLabel })) {
      showFeedback?.("Utvalget kunne ikke sendes videre. Prøv igjen.", "error");
      return;
    }
    navigate(studioTabUrl("epost"));
  };

  /** «Lagre som liste» in the dialog: a filter list keeps the filter, a fixed one keeps the persons shown now. */
  const saveList = (name: string, kind: EmailListKind) => {
    const now = new Date().toISOString();
    const list: EmailList = {
      id: newId("liste"),
      name,
      kind,
      ...(kind === "filter" ? { filter: cleanFilter(filter) } : { personIds: visiblePersons.map((row) => row.person.id) }),
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser?.id ?? "",
    };
    setSavingList(true);
    saveEmailList(list).then(
      () => {
        setSavingList(false);
        setListDialogOpen(false);
        showFeedback?.(`Listen «${name}» er lagret.`);
      },
      (error: unknown) => {
        setSavingList(false);
        showFeedback?.(listFailureText(error, "lagre listen"), "error");
      }
    );
  };

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

        {!clerkOnly && (
        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          className="px-3.5 py-2 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{creating ? "Lukk skjema" : "Ny person"}</span>
        </button>
        )}
        {/* Not in the demo: its database is open to everyone, and a real register must never be put there */}
        {DEMO === null && !clerkOnly && (
          <button
            type="button"
            id="btn-import-cornerstone"
            onClick={() => setImporting(true)}
            className="px-3.5 py-2 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Hent inn fra Cornerstone</span>
          </button>
        )}
        {testDataAllowed && (
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
        )}
      </div>

      {importing && (
        <CornerstoneImportDialog
          register={adminPersons.map((row) => row.person)}
          onDone={(count) => {
            setImporting(false);
            showFeedback?.(`${count} ${count === 1 ? "person" : "personer"} er hentet inn fra Cornerstone.`);
          }}
          onClose={() => setImporting(false)}
        />
      )}

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

      {testDataAllowed && adminPersons.length < 5 && (
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
          <input id="filter-congregation" type="checkbox" checked={filter.congregationMember === true} onChange={(event) => setFlag("congregationMember", event.target.checked)} />
          Medlem i menigheten
        </label>
        <label className="flex items-center gap-2">
          <input id="filter-denomination" type="checkbox" checked={filter.denominationMember === true} onChange={(event) => setFlag("denominationMember", event.target.checked)} />
          Medlem i kirkesamfunnet
        </label>
        <label className="flex items-center gap-2">
          <input id="filter-without-service" type="checkbox" checked={filter.withoutService === true} onChange={(event) => setFlag("withoutService", event.target.checked)} />
          Ikke i noen tjenestegruppe
        </label>
        <FilterMenu id="filter-role" label="Rolle" options={ROLE_OPTIONS} selected={filter.roles ?? []} onChange={(roles) => setFilter((current) => ({ ...current, roles }))} />
        <FilterMenu id="filter-category" label="Gruppetype" options={CATEGORY_OPTIONS} selected={filter.categories ?? []} onChange={(categories) => setFilter((current) => ({ ...current, categories }))} />
        <div className="flex items-center gap-2">
          <label htmlFor="filter-group">Gruppe</label>
          <select
            id="filter-group"
            value={filter.groupId ?? ""}
            onChange={(event) => setFilter((current) => ({ ...current, groupId: event.target.value || undefined }))}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] text-xs text-[var(--studio-text)] max-w-[14rem]"
          >
            <option value="">Alle grupper</option>
            {sortedGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
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

      {narrowed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)]">
          <p id="filter-summary" className="text-xs text-[var(--studio-text)]">
            <strong>
              {visiblePersons.length} {visiblePersons.length === 1 ? "person" : "personer"}
            </strong>
            {headerText ? `: ${headerText}` : ""}
          </p>
          {!clerkOnly && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                id="btn-send-selection"
                onClick={sendSelection}
                disabled={visiblePersons.length === 0}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                Send e-post til utvalget ({visiblePersons.length})
              </button>
              <button
                type="button"
                id="btn-save-list"
                onClick={() => setListDialogOpen(true)}
                disabled={visiblePersons.length === 0}
                className="px-3 py-1.5 rounded-lg bg-[var(--studio-row)] border border-[var(--studio-border)] hover:bg-[var(--studio-hover)] disabled:opacity-50 text-[var(--studio-text)] text-xs font-bold cursor-pointer"
              >
                Lagre som liste ({visiblePersons.length})
              </button>
            </div>
          )}
        </div>
      )}

      {listDialogOpen && (
        <SaveListDialog
          count={visiblePersons.length}
          filterText={filterText}
          canFilter={!searching}
          lists={listsState.lists ?? []}
          saving={savingList}
          onSave={saveList}
          onClose={() => setListDialogOpen(false)}
        />
      )}

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
          {visiblePersons.map((row) => {
            const { person } = row;
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
                    ) : isInServiceGroup(row) ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--studio-bg)] text-[var(--studio-accent-text)]">
                        Frivillig
                      </span>
                    ) : null}

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
