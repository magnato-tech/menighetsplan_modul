import React from "react";
import { useCms } from "../../../context/CmsContext";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { DEMO } from "../../../demo";
import { useGivingAccess } from "../../../hooks/useGivingAccess";
import { lookupLoginPersonId } from "../../../services/giving/access";
import { normalizeGivingAddress } from "../../../utils/giving/access";
import { personsWithEmail } from "../../../utils/session";
import type { ShowFeedback } from "../studio";
import { PaymentInfoSection } from "./giving/PaymentInfoSection";
import { YourAccessSection } from "./giving/YourAccessSection";
import { AccessListSection } from "./giving/AccessListSection";

interface GivingSettingsTabProps {
  showFeedback: ShowFeedback;
}

/**
 * Gaveinnstillinger: who holds which right in givertjeneste, and the payment details the website shows. The rights
 * are the person's own, and are given to one person at a time (see utils/giving/access.ts).
 */
export const GivingSettingsTab: React.FC<GivingSettingsTabProps> = ({ showFeedback }) => {
  const { session, currentUser, allPersons } = useFirebase();
  const { settings } = useCms();
  const giving = useGivingAccess();

  // The demo has no sign-in and no logins: nobody is «own» there, and the persons of the demo stand for the logins
  const ownAddress = DEMO ? "" : normalizeGivingAddress(session.status === "member" ? session.account?.email : null);
  const ownPersonId = DEMO ? "" : currentUser.id;
  const findPerson = (address: string): Promise<string | null> => {
    if (!DEMO) return lookupLoginPersonId(address);
    const found = personsWithEmail(address, allPersons);
    return Promise.resolve(found.length === 1 ? found[0].id : null);
  };

  const showList = giving.state === "active" && giving.access?.manage === true;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-[var(--studio-border)] pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Gaveinnstillinger</h2>
        <p className="text-xs text-[var(--studio-muted)] mt-1">
          Hvem som ser og endrer givertjenesten. Tilgang gis til én person om gangen, uavhengig av andre roller.
        </p>
      </div>

      {DEMO && (
        <p className="text-xs font-semibold text-amber-500">
          Demo: her kan alle se og endre. I en menighets egen løsning gis tilgang bare til dem som er valgt, og de må logge inn med Google.
        </p>
      )}

      {!DEMO &&
        (giving.loading ? (
          <p className="text-xs text-[var(--studio-muted)]">Henter tilgangen din …</p>
        ) : (
          <YourAccessSection
            state={giving.state}
            access={giving.access}
            ownName={currentUser.name}
            byPersonId={currentUser.id}
            reload={giving.reload}
            showFeedback={showFeedback}
          />
        ))}

      {showList && (
        <AccessListSection
          ownAddress={ownAddress}
          ownPersonId={ownPersonId}
          byPersonId={currentUser.id}
          findPerson={findPerson}
          showFeedback={showFeedback}
        />
      )}

      <PaymentInfoSection
        info={{
          vippsNumber: settings.vippsNumber,
          vippsDescription: settings.vippsDescription,
          bankAccount: settings.bankAccount,
          orgNumber: settings.orgNumber,
        }}
      />
    </div>
  );
};
