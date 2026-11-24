import React, { useState } from "react";
import { Filter, List as ListIcon, User, Users, X } from "lucide-react";
import type { Group, Person } from "../../../../types";
import type { EmailList } from "../../../../utils/emailLists";
import { recipientSuggestions, type RecipientChip } from "./chips";
import { studioInputFull } from "../../studioTheme";

interface RecipientFieldProps {
  chips: RecipientChip[];
  onChips: (chips: RecipientChip[]) => void;
  persons: readonly Person[];
  groups: readonly Group[];
  /** The saved lists, offered as suggestions. */
  lists?: readonly EmailList[];
  /** Said to the right of the field, for example «5 personer (4 e-postadresser)». */
  summary: string;
}

const LIST_ID = "email-recipient-list";

/** The field «Til», as in an e-mail program: typed names become chips, and suggestions are offered as one types. */
export const RecipientField: React.FC<RecipientFieldProps> = ({ chips, onChips, persons, groups, lists = [], summary }) => {
  const [query, setQuery] = useState("");
  // Hidden after Escape or when the field is left, until the text is typed again or the field is entered
  const [closed, setClosed] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = recipientSuggestions(query, persons, groups, chips, lists);
  const open = !closed && suggestions.length > 0;
  const shown = Math.min(active, suggestions.length - 1);

  const add = (chip: RecipientChip) => {
    onChips([...chips, chip]);
    setQuery("");
    setActive(0);
    setClosed(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActive((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      add(suggestions[shown].chip);
    } else if (event.key === "Escape") {
      setClosed(true);
    } else if (event.key === "Backspace" && query === "" && chips.length > 0) {
      // On an empty field, the last chip is taken away
      onChips(chips.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
      <div className="relative flex-1 min-w-0">
        <div className={`${studioInputFull} flex flex-wrap items-center gap-1.5 min-h-[2.5rem] focus-within:border-indigo-500`}>
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-lg bg-[var(--studio-row)] text-[11px] font-bold text-[var(--studio-text)]">
              {chip.kind === "audience" && <Users className="w-3 h-3 shrink-0" aria-hidden="true" />}
              {chip.kind === "person" && <User className="w-3 h-3 shrink-0" aria-hidden="true" />}
              {chip.kind === "list" && <ListIcon className="w-3 h-3 shrink-0" aria-hidden="true" />}
              {chip.kind === "selection" && <Filter className="w-3 h-3 shrink-0" aria-hidden="true" />}
              <span>{chip.label}</span>
              <button type="button" onClick={() => onChips(chips.filter((other) => other.key !== chip.key))} aria-label={`Fjern ${chip.label}`} className="p-0.5 rounded hover:bg-[var(--studio-hover)] cursor-pointer">
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id="email-recipients"
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={LIST_ID}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${LIST_ID}-${shown}` : undefined}
            value={query}
            placeholder={chips.length === 0 ? "Skriv et navn, en gruppe eller en adresse" : ""}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setClosed(false);
            }}
            onFocus={() => setClosed(false)}
            onBlur={() => setClosed(true)}
            onKeyDown={onKeyDown}
            className="flex-1 min-w-[8rem] bg-transparent outline-none text-xs text-[var(--studio-text)]"
          />
        </div>
        {open && (
          <ul id={LIST_ID} role="listbox" aria-label="Forslag" className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-lg">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.chip.key}
                id={`${LIST_ID}-${index}`}
                role="option"
                aria-selected={index === shown}
                // The press does not take the focus away from the field
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(suggestion.chip);
                }}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 text-xs ${index === shown ? "bg-[var(--studio-hover)]" : ""}`}
              >
                <span className="font-bold text-[var(--studio-text)] truncate">{suggestion.chip.label}</span>
                <span className="text-[11px] text-[var(--studio-muted)] truncate">{suggestion.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id="email-recipient-count" className="text-[11px] text-[var(--studio-muted)] sm:pt-2.5 sm:whitespace-nowrap">
        <strong className="text-[var(--studio-text)]">{summary}</strong>
      </p>
    </div>
  );
};
