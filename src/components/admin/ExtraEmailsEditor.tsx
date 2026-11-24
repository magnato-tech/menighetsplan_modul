import React from "react";
import type { ExtraEmail } from "../../types";
import { studioDetailInput } from "../../pages/admin/studioDetailTheme";

// The extra e-mail addresses of a person in the person form: one row per address, with the two
// choices of each (see utils/personEmails.ts). The rows are kept by the page, which checks and saves them.

interface ExtraEmailsEditorProps {
  rows: ExtraEmail[];
  onChange: (rows: ExtraEmail[]) => void;
}

export const ExtraEmailsEditor: React.FC<ExtraEmailsEditorProps> = ({ rows, onChange }) => {
  const update = (index: number, change: Partial<ExtraEmail>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-[var(--studio-muted)]">Andre e-postadresser</h4>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            aria-label="Andre e-postadresse"
            value={row.address}
            onChange={(event) => update(index, { address: event.target.value })}
            placeholder="F.eks. kari.jobb@eksempel.no"
            className={`${studioDetailInput} min-w-[12rem] flex-1`}
          />
          <label className="flex items-center gap-1 text-xs text-[var(--studio-text)]">
            <input type="checkbox" checked={row.copy} onChange={(event) => update(index, { copy: event.target.checked })} />
            Få kopi
          </label>
          <label className="flex items-center gap-1 text-xs text-[var(--studio-text)]">
            <input type="checkbox" checked={row.login} onChange={(event) => update(index, { login: event.target.checked })} />
            Logge inn
          </label>
          <button
            type="button"
            aria-label={`Fjern ${row.address.trim() || "adressen"}`}
            onClick={() => remove(index)}
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            Fjern
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { address: "", copy: false, login: true }])}
        className="text-xs font-semibold text-indigo-700 hover:underline"
      >
        + Legg til adresse
      </button>
      <p className="text-[11px] text-[var(--studio-muted)]">
        Kopi: får det samme som hovedadressen. Logge inn: personen kan logge inn med denne adressen. En adresse som står på to personer, kan ingen av dem logge inn med.
      </p>
    </div>
  );
};
