import React, { useState } from "react";
import { FileUp, X } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";
import type { Person } from "../../types";
import { csvFileError, decodeCsvBytes, personInputOf, readCornerstoneFile, SKIP_REASON_TEXT, type CornerstoneImport, type SkipReason } from "../../utils/cornerstoneImport";

interface CornerstoneImportDialogProps {
  /** The persons in the register now, so nobody is added twice. */
  register: readonly Pick<Person, "name" | "email" | "birthDate">[];
  onDone: (count: number) => void;
  onClose: () => void;
}

const people = (count: number): string => `${count} ${count === 1 ? "person" : "personer"}`;

/**
 * Brings persons in from a CSV file exported from Cornerstone. The file is read here in the
 * browser, and the administrator sees what will be added before anything is stored. Only the
 * fields the register has, are taken (see utils/cornerstoneImport.ts).
 */
export const CornerstoneImportDialog: React.FC<CornerstoneImportDialogProps> = ({ register, onDone, onClose }) => {
  const { addPersons } = useFirebase();
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<CornerstoneImport | null>(null);

  const readFile = async (file: File | undefined) => {
    setFound(null);
    setError(null);
    setFileName(file?.name ?? "");
    if (!file) return;
    const bytes = await file.arrayBuffer();
    const wrong = csvFileError(file.name, bytes);
    if (wrong) return setError(wrong);
    const result = readCornerstoneFile(decodeCsvBytes(bytes), register);
    if (result.error) setError(result.error);
    else setFound(result);
  };

  const bringIn = () => {
    if (!found || found.persons.length === 0) return;
    const result = addPersons(found.persons.map(personInputOf));
    if (result.success) onDone(found.persons.length);
    else setError(result.error || "Personene kunne ikke lagres.");
  };

  const skippedFor = (reason: SkipReason) => found?.skipped.filter((row) => row.reason === reason) ?? [];
  const members = found?.persons.filter((person) => person.congregationMember).length ?? 0;
  const denomination = found?.persons.filter((person) => person.denominationMember).length ?? 0;
  const withBirthDate = found?.persons.filter((person) => person.birthDate).length ?? 0;
  const withEmail = found?.persons.filter((person) => person.email).length ?? 0;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cornerstone-import-heading" className="fixed inset-0 z-50 bg-[var(--studio-overlay)] backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--studio-bg)] border border-[var(--studio-border)] p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 id="cornerstone-import-heading" className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <FileUp className="w-4 h-4 text-[var(--studio-icon)]" aria-hidden="true" />
            <span>Hent inn fra Cornerstone</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs text-[var(--studio-muted)]">
          Eksporter personene fra Cornerstone som CSV, og velg filen her. Den leses i nettleseren din, og du ser hva som blir hentet inn før noe lagres.
        </p>
        <p className="text-xs text-[var(--studio-muted)]">
          Bare dette hentes: navn, e-post, telefon, fødselsdato og om personen er medlem i menigheten og i kirkesamfunnet. Fødselsnummer, adresse og alt annet i
          filen blir ikke lagret.
        </p>

        <label className="block text-xs font-bold text-[var(--studio-text)]">
          CSV-fil fra Cornerstone
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void readFile(event.target.files?.[0])}
            className="mt-1.5 block w-full text-xs font-normal text-[var(--studio-text)] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-[var(--studio-border)] file:bg-[var(--studio-surface)] file:text-[var(--studio-text)] file:text-xs file:font-bold file:cursor-pointer"
          />
        </label>

        {error && (
          <p role="alert" className="text-xs text-red-300 bg-red-950/60 border border-red-900 rounded-xl p-3">
            {error}
          </p>
        )}

        {found && (
          <section aria-label="Dette blir hentet inn" className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 space-y-3 text-xs">
            <p className="text-[var(--studio-text)]">
              <strong>{people(found.persons.length)}</strong> blir lagt inn, av {found.rows} i {fileName || "filen"}. Ingenting er lagret ennå.
            </p>
            {found.persons.length > 0 && (
              <ul className="space-y-1 text-[var(--studio-muted)]">
                <li>{withEmail} har e-post, og kan logge inn</li>
                <li>{withBirthDate} har fødselsdato{found.birthDatesFromNationalId > 0 ? ` (${found.birthDatesFromNationalId} hentet fra fødselsnummeret, som ikke lagres)` : ""}</li>
                <li>{members} er medlem i menigheten</li>
                <li>{denomination} er medlem i kirkesamfunnet</li>
              </ul>
            )}

            {found.withoutSharedEmail.length > 0 && (
              <details>
                <summary className="cursor-pointer text-amber-300">
                  {people(found.withoutSharedEmail.length)} legges inn uten e-post, fordi en annen har samme adresse
                </summary>
                <p className="mt-1 text-[var(--studio-muted)]">
                  En adresse kan bare logge inn én person. Adressen blir stående på den som har den fra før, eller på den eldste i filen.
                </p>
                <ul className="mt-1 text-[var(--studio-muted)] list-disc pl-5">
                  {found.withoutSharedEmail.map((row) => (
                    <li key={row.line}>{row.name}</li>
                  ))}
                </ul>
              </details>
            )}

            {(Object.keys(SKIP_REASON_TEXT) as SkipReason[]).map((reason) => {
              const rows = skippedFor(reason);
              return rows.length === 0 ? null : (
                <details key={reason}>
                  <summary className="cursor-pointer text-[var(--studio-text)]">
                    {SKIP_REASON_TEXT[reason]}: {rows.length} hoppes over
                  </summary>
                  <ul className="mt-1 text-[var(--studio-muted)] list-disc pl-5">
                    {rows.map((row) => (
                      <li key={row.line}>
                        {row.name} (linje {row.line})
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </section>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--studio-border)]">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold cursor-pointer">
            Avbryt
          </button>
          <button
            type="button"
            onClick={bringIn}
            disabled={!found || found.persons.length === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
          >
            {found && found.persons.length > 0 ? `Hent inn ${people(found.persons.length)}` : "Hent inn"}
          </button>
        </div>
      </div>
    </div>
  );
};
