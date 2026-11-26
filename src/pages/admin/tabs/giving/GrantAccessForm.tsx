import React, { useState } from "react";
import { reportWriteError } from "../../../../services/writeErrors";
import { saveAccess } from "../../../../services/giving/access";
import {
  GIVING_RIGHTS,
  grantFormError,
  newAccess,
  normalizeGivingAddress,
  type GivingAccess,
  type GivingRights,
} from "../../../../utils/giving/access";
import type { ShowFeedback } from "../../studio";
import { studioCard, studioInputFull, studioPrimaryButton } from "../../studioTheme";

interface GrantAccessFormProps {
  /** Every right given so far: an address that is in it is not given a second one. */
  list: GivingAccess[];
  ownAddress: string;
  ownPersonId: string;
  byPersonId: string;
  /** The person an address stands for, or null. Read from the register, or from the persons in the demo. */
  findPerson: (address: string) => Promise<string | null>;
  showFeedback: ShowFeedback;
}

/** «Gi tilgang»: nothing is chosen from the start. The person is looked up only once the other checks have passed. */
export const GrantAccessForm: React.FC<GrantAccessFormProps> = ({ list, ownAddress, ownPersonId, byPersonId, findPerson, showFeedback }) => {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [rights, setRights] = useState<Partial<GivingRights>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const wanted = normalizeGivingAddress(address);
    const existing = list.find((row) => row.address === wanted) ?? null;
    const input = { address, name, rights, ownAddress, ownPersonId, existing };

    const early = grantFormError({ ...input, foundPersonId: undefined });
    setFormError(early);
    if (early) return;

    setSaving(true);
    try {
      let foundPersonId: string | null;
      try {
        foundPersonId = await findPerson(wanted);
      } catch (failure) {
        reportWriteError("slå opp adressen i personregisteret", failure);
        return;
      }
      const wrong = grantFormError({ ...input, foundPersonId });
      setFormError(wrong);
      if (wrong || foundPersonId === null) return;

      await saveAccess(newAccess({ address: wanted, personId: foundPersonId, name, rights }, byPersonId, new Date()), "grant", byPersonId);
      setAddress("");
      setName("");
      setRights({});
      setFormError(null);
      showFeedback(`${name.trim()} har fått tilgang.`);
    } catch (failure) {
      reportWriteError("gi tilgangen", failure);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="giving-grant-heading" className={`${studioCard} p-4 sm:p-5`}>
      <h4 id="giving-grant-heading" className="text-sm font-bold text-[var(--studio-text)]">
        Gi tilgang
      </h4>
      {/* noValidate: the form says what is wrong in its own words */}
      <form noValidate onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
        <div>
          <label htmlFor="giving-grant-email" className="block text-xs font-bold text-[var(--studio-text)]">
            E-post
          </label>
          <input
            id="giving-grant-email"
            type="text"
            inputMode="email"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={`${studioInputFull} mt-1.5 font-normal`}
          />
        </div>

        <div>
          <label htmlFor="giving-grant-name" className="block text-xs font-bold text-[var(--studio-text)]">
            Navn
          </label>
          <input
            id="giving-grant-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`${studioInputFull} mt-1.5 font-normal`}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-[var(--studio-text)]">Tilganger</legend>
          {GIVING_RIGHTS.map((right) => (
            <label key={right.id} className="flex items-start gap-2 text-xs text-[var(--studio-text)] cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={rights[right.id] === true}
                onChange={(event) => setRights({ ...rights, [right.id]: event.target.checked })}
              />
              <span>
                <span className="font-bold">{right.label}</span>
                <span className="block text-[11px] text-[var(--studio-muted)]">{right.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {formError && (
          <p role="alert" className="text-xs font-semibold text-rose-400">
            {formError}
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={`${studioPrimaryButton} px-4 py-2 text-xs`}>
            Gi tilgang
          </button>
        </div>
      </form>
    </section>
  );
};
