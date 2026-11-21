import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../../context/FirebaseDataContext";
import { subscribeDocument } from "../../services/firestore";
import { COLLECTIONS } from "../../data/collections";
import type { MembershipApplication } from "../../types";
import { canManageMembershipApplications } from "./membershipClerk";
import { StudioDetailShell } from "./StudioDetailShell";
import { membershipApplicationKindLabel } from "../../utils/membershipApplication";
import {
  completeMembershipApplication,
  dismissMembershipApplication,
  markMembershipApplicationCornerstone,
  receiveMembershipApplication,
} from "../../services/membershipApplications";
import { reportWriteError } from "../../services/writeErrors";
import { useTimedMessage } from "../../hooks/useTimedMessage";
import { MembershipApplicationDetailBody } from "./membership/MembershipApplicationDetailBody";

export const MembershipApplicationArchivePage: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const { currentUser } = useFirebase();
  const [application, setApplication] = useState<MembershipApplication | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();

  const allowed = useMemo(() => canManageMembershipApplications(currentUser), [currentUser]);

  React.useEffect(() => {
    if (!allowed) return;
    return subscribeDocument<MembershipApplication>(COLLECTIONS.MEMBERSHIP_APPLICATIONS, applicationId, (doc) => {
      setApplication(doc);
      setLoaded(true);
    });
  }, [applicationId, allowed]);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      showFeedback({ text: label, type: "success" });
    } catch (error) {
      reportWriteError("lagre", error);
      showFeedback({ text: "Kunne ikke lagre.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <p className="text-sm text-[var(--studio-muted)]">Du har ikke tilgang til arkivet for medlemskapssøknader.</p>
    );
  }

  if (!loaded) return null;

  if (!application) {
    return (
      <StudioDetailShell
        backTab="planlegger-medlemskap"
        backLabel="Tilbake til Medlemskap"
        badge="Arkiv"
        feedback={feedback}
      >
        <p className="text-sm text-[var(--studio-muted)]">Fant ikke søknaden.</p>
      </StudioDetailShell>
    );
  }

  return (
    <StudioDetailShell
      backTab="planlegger-medlemskap"
      backLabel="Tilbake til Medlemskap"
      badge="Medlemskap – arkiv"
      feedback={feedback}
    >
      <div className="space-y-4 max-w-3xl">
        <p className="text-xs text-[var(--studio-muted)]">
          Konfidensielt arkiv · {membershipApplicationKindLabel[application.kind]}
        </p>
        <Link
          to={`/admin/person/${application.personId}`}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
        >
          Person i registeret
        </Link>
        <MembershipApplicationDetailBody
          app={application}
          busy={busy}
          onReceive={() => run("Mottatt.", () => receiveMembershipApplication(application, currentUser!.id))}
          onCornerstone={() =>
            run("Merket som ført i Cornerstone.", () => markMembershipApplicationCornerstone(application, currentUser!.id))
          }
          onComplete={(reference) =>
            run("Bekreftet i Menighetsplan.", () => completeMembershipApplication(application, currentUser!.id, reference))
          }
          onDismiss={() => run("Avvist.", () => dismissMembershipApplication(application, currentUser!.id))}
        />
      </div>
    </StudioDetailShell>
  );
};