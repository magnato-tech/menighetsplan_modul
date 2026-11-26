import React, { useState } from "react";
import { useConfirm } from "../../../../components/ConfirmProvider";
import { useGivingAccessList } from "../../../../hooks/useGivingAccessList";
import { saveAccess } from "../../../../services/giving/access";
import { reportWriteError } from "../../../../services/writeErrors";
import {
  accessStatusLabel,
  canEditRow,
  changedAccess,
  GIVING_RIGHTS,
  hasAnyRight,
  rightLabelsOf,
  type GivingAccess,
  type GivingRights,
} from "../../../../utils/giving/access";
import type { ShowFeedback } from "../../studio";
import { studioCard, studioPrimaryButton, studioSecondaryButton } from "../../studioTheme";
import { GrantAccessForm } from "./GrantAccessForm";

interface AccessListSectionProps {
  /** The address the administrator signs in with. Empty in the demo. */
  ownAddress: string;
  /** The administrator's own person. Empty in the demo. */
  ownPersonId: string;
  /** The person who makes the change, as it is written in the log. */
  byPersonId: string;
  /** The person an address stands for in the register, or null: looked up in the register, or in the demo's persons. */
  findPerson: (address: string) => Promise<string | null>;
  showFeedback: ShowFeedback;
}

const NO_RIGHTS: Partial<GivingRights> = { overview: false, budget: false, individual: false, manage: false };

/** The four rights of a row, as the form starts from them. */
const rightsOf = (row: GivingAccess): Partial<GivingRights> => ({
  overview: row.overview === true,
  budget: row.budget === true,
  individual: row.individual === true,
  manage: row.manage === true,
});

/** Who holds which right in givertjeneste. Only someone with «Tilganger» sees and changes it. */
export const AccessListSection: React.FC<AccessListSectionProps> = ({ ownAddress, ownPersonId, byPersonId, findPerson, showFeedback }) => {
  const { list, problem } = useGivingAccessList();
  const confirmInPage = useConfirm();
  // One write at a time: nothing else is sent while it is on its way
  const [saving, setSaving] = useState(false);
  // The row being changed, and the rights chosen for it so far
  const [editing, setEditing] = useState<{ address: string; rights: Partial<GivingRights> } | null>(null);

  const writeChange = async (row: GivingAccess, changes: { rights?: Partial<GivingRights>; resetGoogle?: boolean }, what: string) => {
    if (saving) return false;
    setSaving(true);
    try {
      await saveAccess(changedAccess(row, changes, byPersonId, new Date()), "change", byPersonId);
      return true;
    } catch (failure) {
      reportWriteError(what, failure);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (row: GivingAccess) => {
    if (!editing) return;
    const done = await writeChange(row, { rights: editing.rights }, "endre tilgangen");
    if (!done) return;
    setEditing(null);
    showFeedback(`Tilgangen er endret for ${row.name}.`);
  };

  const removeAll = async (row: GivingAccess) => {
    if (saving) return;
    if (!(await confirmInPage(`Vil du fjerne all tilgang for ${row.name}? Personen står fortsatt i listen, uten rettigheter.`, { yes: "Fjern all tilgang", danger: true }))) return;
    if (await writeChange(row, { rights: NO_RIGHTS }, "fjerne tilgangen")) showFeedback(`All tilgang er fjernet for ${row.name}.`);
  };

  const resetGoogle = async (row: GivingAccess) => {
    if (await writeChange(row, { resetGoogle: true }, "tilbakestille Google-kontoen")) {
      showFeedback(`Google-kontoen til ${row.name} er tilbakestilt.`);
    }
  };

  const sorted = list ? [...list].sort((a, b) => a.name.localeCompare(b.name, "nb")) : [];

  return (
    <section aria-labelledby="giving-access-list-heading" className="space-y-4">
      <h3 id="giving-access-list-heading" className="text-sm font-bold text-[var(--studio-text)]">
        Hvem har tilgang
      </h3>

      {problem === "denied" ? (
        <p role="alert" className="text-xs font-semibold text-rose-400">
          Databasen avviste lesingen. Sikkerhetsreglene må publiseres på nytt.
        </p>
      ) : problem === "failed" ? (
        <p role="alert" className="text-xs font-semibold text-rose-400">
          Tilgangslisten kunne ikke hentes. Last siden på nytt for å prøve igjen.
        </p>
      ) : list === null ? (
        <p className="text-xs text-[var(--studio-muted)]">Henter tilgangene …</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)]">Ingen har fått tilgang ennå.</p>
      ) : (
        <ul className={`${studioCard} divide-y divide-[var(--studio-border)]`}>
          {sorted.map((row) => {
            const editable = canEditRow(row, ownAddress, ownPersonId);
            const isEditing = editing?.address === row.address;
            return (
              <li key={row.address} className="px-4 py-3 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--studio-text)] break-words">{row.name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--studio-muted)] break-all">{row.address}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--studio-text)]">
                      {hasAnyRight(row) ? rightLabelsOf(row).join(", ") : "Ingen rettigheter"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--studio-muted)]">{accessStatusLabel(row)}</p>
                  </div>

                  {editable ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isEditing && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setEditing({ address: row.address, rights: rightsOf(row) })}
                          className={studioSecondaryButton}
                        >
                          Endre
                        </button>
                      )}
                      <button type="button" disabled={saving} onClick={() => void removeAll(row)} className={studioSecondaryButton}>
                        Fjern all tilgang
                      </button>
                      {row.googleId && (
                        <button type="button" disabled={saving} onClick={() => void resetGoogle(row)} className={studioSecondaryButton}>
                          Tilbakestill Google-konto
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--studio-muted)] max-w-xs">
                      Din egen tilgang kan bare endres av en annen med «Tilganger».
                    </p>
                  )}
                </div>

                {isEditing && editing && (
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveEdit(row);
                    }}
                    className="space-y-3"
                  >
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-bold text-[var(--studio-text)]">Tilganger</legend>
                      {GIVING_RIGHTS.map((right) => (
                        <label key={right.id} className="flex items-start gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={editing.rights[right.id] === true}
                            onChange={(event) => setEditing({ ...editing, rights: { ...editing.rights, [right.id]: event.target.checked } })}
                          />
                          <span>
                            <span className="font-bold">{right.label}</span>
                            <span className="block text-[11px] text-[var(--studio-muted)]">{right.description}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(null)} className={studioSecondaryButton}>
                        Avbryt
                      </button>
                      <button type="submit" disabled={saving} className={`${studioPrimaryButton} px-3 py-1.5 text-xs`}>
                        Lagre
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {list !== null && (
        <GrantAccessForm
          list={list}
          ownAddress={ownAddress}
          ownPersonId={ownPersonId}
          byPersonId={byPersonId}
          findPerson={findPerson}
          showFeedback={showFeedback}
        />
      )}
    </section>
  );
};
