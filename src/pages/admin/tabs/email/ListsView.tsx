import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteEmailList, renameEmailList, setListPersons } from "../../../../services/emailLists";
import type { Group, Person } from "../../../../types";
import { listFailureText, LISTS_NOT_PUBLISHED, listNameError, listPersonIds, type EmailList } from "../../../../utils/emailLists";
import { describeFilter } from "../../../../utils/personFilter";
import { studioTabUrl, type ShowFeedback } from "../../studio";
import { studioCardPadded, studioInputFull, studioPrimaryButton, studioSecondaryButton } from "../../studioTheme";
import { people, type Ask } from "./chips";
import { hint } from "./emailStyles";

export interface ListsViewProps {
  /** The lists, or null while they are read. */
  lists: EmailList[] | null;
  /** Why they cannot be read: the rules are not published again yet, or something else went wrong. */
  problem: "denied" | "failed" | null;
  persons: Person[];
  groups: Group[];
  canSend: boolean;
  showFeedback: ShowFeedback;
  /** Starts an e-mail to the list: «Ny e-post» with the list as its only chip. */
  onSendToList: (list: EmailList) => void;
  /** Asks before a list is deleted, in the page. */
  ask: Ask;
}

/** «Lister» in «Send e-post»: the lists saved on the «Personer» tab, and what can be done with each. */
export const ListsView: React.FC<ListsViewProps> = ({ lists, problem, persons, groups, canSend, showFeedback, onSendToList, ask }) => {
  const sorted = useMemo(() => [...(lists ?? [])].sort((a, b) => a.name.localeCompare(b.name, "nb")), [lists]);

  let body: React.ReactNode;
  if (problem === "denied") body = <p role="status" className="text-xs text-amber-500">{LISTS_NOT_PUBLISHED}</p>;
  else if (problem === "failed") body = <p className="text-xs text-red-400">Listene kunne ikke leses. Prøv igjen senere.</p>;
  else if (lists === null) body = <p className="text-xs text-[var(--studio-muted)]">Henter listene …</p>;
  else if (sorted.length === 0) body = <p className="text-xs text-[var(--studio-muted)] italic">Ingen lister ennå.</p>;
  else
    body = (
      <ul className="divide-y divide-[var(--studio-border)]">
        {sorted.map((list) => (
          <ListRow key={list.id} list={list} allLists={sorted} persons={persons} groups={groups} canSend={canSend} showFeedback={showFeedback} onSendToList={onSendToList} ask={ask} />
        ))}
      </ul>
    );

  return (
    <section aria-label="Lister" className={`${studioCardPadded} space-y-4`}>
      <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Lister</h3>
      <p className={hint}>
        Nye lister lager du fra{" "}
        <Link to={studioTabUrl("planlegger-personer")} className="font-bold text-indigo-500 underline">
          Personer
        </Link>
        : filtrer og trykk «Lagre som liste».
      </p>
      {body}
    </section>
  );
};

interface ListRowProps {
  list: EmailList;
  allLists: EmailList[];
  persons: Person[];
  groups: Group[];
  canSend: boolean;
  showFeedback: ShowFeedback;
  onSendToList: (list: EmailList) => void;
  ask: Ask;
}

/** One list: what it is, who is on it, and the actions. The names and the adding open below it. */
const ListRow: React.FC<ListRowProps> = ({ list, allLists, persons, groups, canSend, showFeedback, onSendToList, ask }) => {
  const [open, setOpen] = useState(false);
  // The name being typed while renaming, null when not renaming
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  // The text typed to find a person for a fixed list, null while adding is closed
  const [adding, setAdding] = useState<string | null>(null);

  const ids = useMemo(() => listPersonIds(list, persons, groups), [list, persons, groups]);
  const onList = useMemo(() => new Set(ids), [ids]);
  const names = useMemo(() => persons.filter((person) => onList.has(person.id)).sort((a, b) => a.name.localeCompare(b.name, "nb")), [persons, onList]);
  const candidates = useMemo(() => {
    const typed = (adding ?? "").trim().toLocaleLowerCase("nb");
    if (adding === null || typed === "") return [];
    return persons
      .filter((person) => !onList.has(person.id) && (person.name.toLocaleLowerCase("nb").includes(typed) || (person.email ?? "").toLocaleLowerCase("nb").includes(typed)))
      .slice(0, 8);
  }, [adding, persons, onList]);

  const summary = list.kind === "filter" ? `Oppdateres av seg selv · ${describeFilter(list.filter ?? {}, groups)}` : "Fast utvalg";

  const rename = () => {
    const name = (renaming ?? "").trim();
    const wrong = listNameError(name, allLists, list.id);
    if (wrong) return setRenameError(wrong);
    renameEmailList(list.id, name).then(
      () => {
        setRenaming(null);
        setRenameError(null);
        showFeedback(`Listen heter nå «${name}».`);
      },
      (error) => showFeedback(listFailureText(error, "gi listen nytt navn"), "error")
    );
  };

  const remove = async () => {
    if (!(await ask(`Slette listen «${list.name}»? Personene slettes ikke, bare listen.`, "Slett"))) return;
    deleteEmailList(list.id).then(
      () => showFeedback(`Listen «${list.name}» er slettet.`),
      (error) => showFeedback(listFailureText(error, "slette listen"), "error")
    );
  };

  const setPersons = (personIds: string[], action: string) => {
    setListPersons(list.id, personIds).catch((error: unknown) => showFeedback(listFailureText(error, action), "error"));
  };

  return (
    <li className="py-3 space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--studio-text)] break-words">{list.name}</p>
          <p className="text-[11px] text-[var(--studio-muted)]">
            {summary} · {people(ids.length)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={studioSecondaryButton}>
            Vis personer
          </button>
          {list.kind === "fixed" && (
            <button type="button" aria-expanded={adding !== null} onClick={() => setAdding((current) => (current === null ? "" : null))} className={studioSecondaryButton}>
              Legg til person
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setRenaming(list.name);
              setRenameError(null);
            }}
            className={studioSecondaryButton}
          >
            Gi nytt navn
          </button>
          <button type="button" onClick={() => void remove()} className={studioSecondaryButton}>
            Slett
          </button>
          <button type="button" onClick={() => onSendToList(list)} disabled={!canSend} className={`${studioPrimaryButton} px-3 py-1.5 text-xs disabled:opacity-50`}>
            Send e-post til listen
          </button>
        </div>
      </div>

      {renaming !== null && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input aria-label={`Nytt navn på ${list.name}`} value={renaming} onChange={(event) => setRenaming(event.target.value)} className={`${studioInputFull} sm:max-w-xs`} />
          <button type="button" onClick={rename} className={`${studioPrimaryButton} px-3 py-1.5 text-xs`}>
            Lagre navn
          </button>
          <button type="button" onClick={() => setRenaming(null)} className={studioSecondaryButton}>
            Avbryt
          </button>
          {renameError && (
            <p role="alert" className="text-xs font-bold text-red-400">
              {renameError}
            </p>
          )}
        </div>
      )}

      {adding !== null && (
        <div className="space-y-2">
          <input
            aria-label={`Finn person til ${list.name}`}
            type="text"
            value={adding}
            placeholder="Søk etter navn eller adresse"
            onChange={(event) => setAdding(event.target.value)}
            className={`${studioInputFull} sm:max-w-xs`}
          />
          {candidates.length > 0 && (
            <ul className="rounded-xl border border-[var(--studio-border)] divide-y divide-[var(--studio-border)] max-w-md">
              {candidates.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    aria-label={`Legg til ${person.name}`}
                    onClick={() => {
                      setPersons([...(list.personIds ?? []), person.id], "legge til personen");
                      setAdding("");
                    }}
                    className="w-full px-3 py-2 text-left text-xs flex justify-between gap-3 hover:bg-[var(--studio-hover)] cursor-pointer"
                  >
                    <span className="font-bold text-[var(--studio-text)]">{person.name}</span>
                    <span className="text-[var(--studio-muted)] truncate">{person.email || "ingen e-postadresse"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open &&
        (names.length === 0 ? (
          <p className="text-xs text-[var(--studio-muted)] italic">Ingen personer på listen.</p>
        ) : (
          <ul className="space-y-1">
            {names.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 text-xs text-[var(--studio-text)]">
                <span>{person.name}</span>
                {list.kind === "fixed" && (
                  <button
                    type="button"
                    aria-label={`Fjern ${person.name} fra listen`}
                    onClick={() => setPersons((list.personIds ?? []).filter((id) => id !== person.id), "fjerne personen")}
                    className="px-2 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </li>
  );
};
