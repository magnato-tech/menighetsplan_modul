import React, { useState } from "react";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useGivingPurposes } from "../../../hooks/useGivingPurposes";
import { buildGivingPurpose } from "../../../data/newDocuments";
import { createGivingPurpose, renameGivingPurpose, setGivingPurposeActive } from "../../../services/giving/purposes";
import { reportWriteError } from "../../../services/writeErrors";
import {
  cleanPurposeName,
  GIVING_USAGE_LABELS,
  purposeFormError,
  sortPurposes,
  type GivingPurpose,
  type GivingPurposeUsage,
} from "../../../utils/giving/purposes";
import type { ShowFeedback } from "../studio";
import { studioCard, studioInputFull, studioPrimaryButton, studioSecondaryButton } from "../studioTheme";

interface GivingPurposesTabProps {
  showFeedback: ShowFeedback;
}

const USAGES: GivingPurposeUsage[] = ["drift", "oremerket"];

/** The gift purposes an administrator keeps: what a gift can be given to. A purpose is never deleted. */
export const GivingPurposesTab: React.FC<GivingPurposesTabProps> = ({ showFeedback }) => {
  const { currentUser } = useFirebase();
  const { purposes, problem } = useGivingPurposes();

  // The new purpose. Neither type is chosen from the start.
  const [name, setName] = useState("");
  const [usage, setUsage] = useState<GivingPurposeUsage | "">("");
  const [formError, setFormError] = useState<string | null>(null);

  // The purpose whose name is being changed, and what is typed for it
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // While a write is on its way, nothing else is sent
  const [saving, setSaving] = useState(false);

  const addPurpose = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !purposes) return;
    const wrong = purposeFormError(name, usage, purposes);
    setFormError(wrong);
    if (wrong || usage === "") return;
    const purpose = buildGivingPurpose({ name, usage }, currentUser.id);
    setSaving(true);
    createGivingPurpose(purpose)
      .then(() => {
        setName("");
        setUsage("");
        setFormError(null);
        showFeedback(`«${purpose.name}» er lagt til.`);
      })
      .catch((failure: unknown) => reportWriteError("lagre gaveformålet", failure))
      .finally(() => setSaving(false));
  };

  const startEdit = (purpose: GivingPurpose) => {
    setEditingId(purpose.id);
    setEditName(purpose.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveName = (event: React.FormEvent<HTMLFormElement>, purpose: GivingPurpose) => {
    event.preventDefault();
    if (saving || !purposes) return;
    const wrong = purposeFormError(editName, purpose.usage, purposes, purpose.id);
    setEditError(wrong);
    if (wrong) return;
    setSaving(true);
    renameGivingPurpose(purpose.id, editName, currentUser.id)
      .then(() => {
        setEditingId(null);
        setEditError(null);
        showFeedback(`Navnet er endret til «${cleanPurposeName(editName)}».`);
      })
      .catch((failure: unknown) => reportWriteError("endre navnet på gaveformålet", failure))
      .finally(() => setSaving(false));
  };

  const toggleActive = (purpose: GivingPurpose) => {
    if (saving) return;
    setSaving(true);
    setGivingPurposeActive(purpose.id, !purpose.active, currentUser.id)
      .then(() =>
        showFeedback(
          purpose.active
            ? `«${purpose.name}» er tatt ut av bruk. Ingenting er slettet.`
            : `«${purpose.name}» er tatt i bruk igjen.`
        )
      )
      .catch((failure: unknown) =>
        reportWriteError(purpose.active ? "ta gaveformålet ut av bruk" : "ta gaveformålet i bruk igjen", failure)
      )
      .finally(() => setSaving(false));
  };

  // Shown instead of the form and the list when they cannot be read, or are still being read
  const notice =
    problem === "denied"
      ? "Databasen avviste lesingen. Sikkerhetsreglene må publiseres på nytt før gaveformål kan brukes."
      : problem === "failed"
        ? "Gaveformålene kunne ikke hentes. Last siden på nytt for å prøve igjen."
        : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-[var(--studio-border)] pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Gaveformål</h2>
        <p className="text-xs text-[var(--studio-muted)] mt-1">
          Hva en gave kan gis til. Et formål slettes ikke: ta det ut av bruk når det ikke gjelder lenger.
        </p>
      </div>

      {notice ? (
        <p role="alert" className="text-xs font-semibold text-rose-400">
          {notice}
        </p>
      ) : purposes === null ? (
        <p className="text-xs text-[var(--studio-muted)]">Henter gaveformålene …</p>
      ) : (
        <>
          <section aria-labelledby="giving-new-heading" className={`${studioCard} p-4 sm:p-5`}>
            <h3 id="giving-new-heading" className="text-sm font-bold text-[var(--studio-text)]">
              Nytt gaveformål
            </h3>
            {/* noValidate: the form says what is wrong in its own words */}
            <form noValidate onSubmit={addPurpose} className="mt-4 space-y-4">
              <div>
                <label htmlFor="giving-purpose-name" className="block text-xs font-bold text-[var(--studio-text)]">
                  Navn
                </label>
                <input
                  id="giving-purpose-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={`${studioInputFull} mt-1.5 font-normal`}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-[var(--studio-text)]">Type</legend>
                <div className="flex flex-wrap gap-5">
                  {USAGES.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
                      <input
                        type="radio"
                        name="giving-purpose-usage"
                        value={option}
                        checked={usage === option}
                        onChange={() => setUsage(option)}
                      />
                      <span>{GIVING_USAGE_LABELS[option]}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--studio-muted)]">Typen kan ikke endres etterpå.</p>
              </fieldset>

              {formError && (
                <p role="alert" className="text-xs font-semibold text-rose-400">
                  {formError}
                </p>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className={`${studioPrimaryButton} px-4 py-2 text-xs`}>
                  Legg til
                </button>
              </div>
            </form>
          </section>

          <section aria-labelledby="giving-list-heading" className="space-y-3">
            <h3 id="giving-list-heading" className="text-sm font-bold text-[var(--studio-text)]">
              Gaveformålene
            </h3>
            {purposes.length === 0 ? (
              <p className="text-xs text-[var(--studio-muted)]">Ingen gaveformål ennå.</p>
            ) : (
              <ul className={`${studioCard} divide-y divide-[var(--studio-border)]`}>
                {sortPurposes(purposes).map((purpose) => (
                  <li key={purpose.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    {editingId === purpose.id ? (
                      <form noValidate onSubmit={(event) => saveName(event, purpose)} className="flex flex-1 flex-wrap items-start gap-2">
                        <div className="flex-1 min-w-[12rem]">
                          <input
                            type="text"
                            aria-label={`Nytt navn for ${purpose.name}`}
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            autoFocus
                            className={studioInputFull}
                          />
                          {editError && (
                            <p role="alert" className="mt-1 text-xs font-semibold text-rose-400">
                              {editError}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="submit" disabled={saving} className={`${studioPrimaryButton} px-3 py-1.5 text-xs`}>
                            Lagre
                          </button>
                          <button type="button" onClick={cancelEdit} className={studioSecondaryButton}>
                            Avbryt
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--studio-text)] break-words">{purpose.name}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--studio-muted)]">
                            {GIVING_USAGE_LABELS[purpose.usage]}
                            {!purpose.active && <span className="ml-2 font-semibold text-amber-500">Ute av bruk</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" onClick={() => startEdit(purpose)} disabled={saving} className={studioSecondaryButton}>
                            Endre navn
                          </button>
                          <button type="button" onClick={() => toggleActive(purpose)} disabled={saving} className={studioSecondaryButton}>
                            {purpose.active ? "Ta ut av bruk" : "Ta i bruk igjen"}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
