import React, { useMemo, useState } from "react";
import type { Person } from "../../../types";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { withExtraEmail } from "../../../utils/personForm";
import { studioDetailInput } from "../studioDetailTheme";
import { studioSecondaryButton } from "../studioTheme";

// The «Legg til på person» action of the Innlogging tab: an address that stopped a sign-in is added to a
// person as an extra address that may sign in. It is saved the same way as the person form does it.

interface AddAddressToPersonProps {
  address: string;
  persons: Person[];
  /** Says what was done. The tab keeps it, since this row leaves the list once the address can sign in. */
  onAdded: (text: string) => void;
}

const SHOWN = 8;

export const AddAddressToPerson: React.FC<AddAddressToPersonProps> = ({ address, persons, onAdded }) => {
  const { updatePerson } = useFirebase();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    return [...persons]
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .filter((person) => wanted === "" || person.name.toLowerCase().includes(wanted))
      .slice(0, SHOWN);
  }, [persons, query]);

  const add = (person: Person) => {
    const next = withExtraEmail(person, address);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    const res = updatePerson(person.id, { extraEmails: next.extraEmails });
    if (res.success) {
      onAdded(`Adressen er lagt til på ${person.name}. Personen kan logge inn med den nå.`);
      setOpen(false);
      setQuery("");
      setError(null);
    } else {
      setError(res.error || "Kunne ikke lagre personen.");
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${studioSecondaryButton} ml-auto`}>
        Legg til på person …
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-[var(--studio-border)] p-3">
      <input
        type="search"
        aria-label="Søk etter person"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Søk etter navn"
        className={studioDetailInput}
      />
      <ul className="space-y-1">
        {matches.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => add(person)} className="text-xs font-bold text-[var(--studio-link)] hover:underline">
              {person.name}
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && <p className="text-xs text-[var(--studio-muted)]">Ingen personer med det navnet.</p>}
      {error && <p className="text-xs font-bold text-red-700">{error}</p>}
      <button type="button" onClick={() => setOpen(false)} className={studioSecondaryButton}>
        Avbryt
      </button>
    </div>
  );
};
