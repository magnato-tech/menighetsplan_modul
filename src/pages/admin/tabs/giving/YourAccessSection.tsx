import React, { useState } from "react";
import { reportWriteError } from "../../../../services/writeErrors";
import { readGoogleSignIn } from "../../../../services/auth";
import { saveAccess } from "../../../../services/giving/access";
import { activatedAccess, rightLabelsOf, type GivingAccess, type OwnAccessState } from "../../../../utils/giving/access";
import type { ShowFeedback } from "../../studio";
import { studioCard, studioPrimaryButton } from "../../studioTheme";

interface YourAccessSectionProps {
  state: OwnAccessState;
  /** The rights on the address the administrator signs in with, or null. */
  access: GivingAccess | null;
  /** The person's name in the register: what the rights are taken into use under. */
  ownName: string;
  byPersonId: string;
  /** Reads the sign-in and the rights again, after the rights were taken into use. */
  reload: () => void;
  showFeedback: ShowFeedback;
}

const STATE_TEXT: Record<Exclude<OwnAccessState, "needs-activation" | "active">, string> = {
  none: "Du har ingen tilgang til givertjenesten. Å være administrator gir ikke tilgang. Tilgang gis av den som har «Tilganger». Den første gis av den som eier løsningen.",
  "other-person": "Tilgangen på denne e-postadressen gjelder en annen person. Den som har «Tilganger», må gi den på nytt.",
  "needs-google": "Logg ut, og logg inn med Google for å bruke tilgangen.",
  "wrong-google": "Tilgangen er tatt i bruk med en annen Google-konto. Den som har «Tilganger», må tilbakestille den.",
};

/** The person's own rights, and what is missing before they can be used. Not shown in the demo. */
export const YourAccessSection: React.FC<YourAccessSectionProps> = ({ state, access, ownName, byPersonId, reload, showFeedback }) => {
  const [saving, setSaving] = useState(false);
  const rights = rightLabelsOf(state === "none" ? null : access);

  // The Google account is read again when the button is pressed, so the one stored is the one signed in now
  const activate = async () => {
    if (saving || !access) return;
    setSaving(true);
    try {
      const signIn = await readGoogleSignIn();
      if (!signIn.withGoogle || !signIn.googleId) {
        reportWriteError("ta i bruk tilgangen", new Error("Innloggingen er ikke med Google. Logg ut, og logg inn med Google."));
        return;
      }
      await saveAccess(activatedAccess(access, signIn.googleId, ownName, new Date(), byPersonId), "activate", byPersonId);
      showFeedback("Tilgangen er tatt i bruk.");
      reload();
    } catch (failure) {
      reportWriteError("ta i bruk tilgangen", failure);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="giving-own-access-heading" className={`${studioCard} p-4 sm:p-5 space-y-3`}>
      <h3 id="giving-own-access-heading" className="text-sm font-bold text-[var(--studio-text)]">
        Din tilgang
      </h3>

      {state === "needs-activation" ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--studio-text)]">Tilgangen er klar til å tas i bruk med Google-kontoen du er logget inn med.</p>
          <div className="flex justify-end">
            <button type="button" onClick={() => void activate()} disabled={saving} className={`${studioPrimaryButton} px-4 py-2 text-xs`}>
              Ta i bruk tilgangen
            </button>
          </div>
        </div>
      ) : state === "active" ? (
        <p className="text-xs text-[var(--studio-text)]">Tilgangen er i bruk.</p>
      ) : (
        <p className="text-xs text-[var(--studio-text)]">{STATE_TEXT[state]}</p>
      )}

      {rights.length > 0 && <p className="text-[11px] text-[var(--studio-muted)]">Tilgangene dine: {rights.join(", ")}.</p>}
    </section>
  );
};
