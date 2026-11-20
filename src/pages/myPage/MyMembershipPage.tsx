import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MinSideFrame } from "../../components/minSide/MinSideFrame";
import { useFirebase } from "../../context/FirebaseDataContext";
import { useCms } from "../../context/CmsContext";
import { canOpenMyMembership } from "../../utils/membershipAccess";
import {
  membershipPageSettings,
  myMembershipView,
  type MembershipAction,
  type MembershipTierLine,
} from "../../utils/membershipView";
import { membershipFormPath, MEMBERSHIP_ARCHIVE_NOTICE } from "../../utils/membershipApplication";
import { useMyMembershipApplications } from "../../hooks/useMyMembershipApplications";
import { hasOpenDenominationGToAApplication } from "../../utils/denominationGToA";

const ACTION_LABEL: Record<MembershipAction, string> = {
  combinedApply: "Søk medlemskap i menighet og trossamfunn",
  congregationApply: "Søk medlemskap i menigheten",
  denominationEnroll: "Meld deg inn i kirkesamfunnet",
  denominationGToA: "Bekreft medlemskap som voksen (G → A)",
};

const TierCard: React.FC<{
  tier: MembershipTierLine;
  headingId: string;
  actionTo?: string;
  followUpTo?: string;
}> = ({ tier, headingId, actionTo, followUpTo }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2" aria-labelledby={headingId}>
    <h2 id={headingId} className="text-sm font-black text-slate-900">
      {tier.title}
    </h2>
    <p
      className={`inline-flex text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${
        tier.isMember ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"
      }`}
    >
      {tier.status}
    </p>
    {tier.enrollmentType && (
      <p className="text-sm text-slate-800">
        <span className="font-semibold">Medlemskap i trossamfunnet: </span>
        {tier.enrollmentType}
      </p>
    )}
    {tier.detail && <p className="text-xs text-slate-600">{tier.detail}</p>}
    {tier.membershipAction && actionTo && (
      <Link
        to={actionTo}
        className={`mt-2 block w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold ${
          tier.membershipAction === "congregationApply" || tier.membershipAction === "combinedApply"
            ? "bg-primary-700 text-white"
            : "bg-white border border-primary-300 text-primary-900"
        }`}
      >
        {ACTION_LABEL[tier.membershipAction]}
      </Link>
    )}
    {tier.followUpAction && followUpTo && (
      <Link
        to={followUpTo}
        className="mt-2 block w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-700 text-white"
      >
        {ACTION_LABEL[tier.followUpAction]}
      </Link>
    )}
  </section>
);

/** Min side: the signed-in person's membership in the congregation and denomination. */
export const MyMembershipPage: React.FC = () => {
  const { currentUser, groups } = useFirebase();
  const { settings } = useCms();

  if (!canOpenMyMembership(currentUser, groups)) {
    return <Navigate to="/minside" replace />;
  }

  const page = membershipPageSettings(settings);
  const myApplications = useMyMembershipApplications(currentUser.id, true);
  const view = myMembershipView(currentUser, groups, page, myApplications);
  const location = useLocation();
  const gToAPending = hasOpenDenominationGToAApplication(currentUser.id, myApplications);
  const sent = (location.state as { membershipSent?: string } | null)?.membershipSent;

  const sentMessage =
    sent === "soknad"
      ? "Søknaden er sendt til menigheten. Du hører fra oss når den er behandlet."
      : sent === "soknad-barn"
        ? "Søknaden er sendt. Husk å fylle ut skjema for barn hvis det gjelder."
        : sent === "innmelding"
          ? "Innmeldingen i trossamfunnet er sendt til menigheten."
          : sent === "barn"
          ? "Skjemaet for barn er sendt til menigheten."
          : sent === "g-til-a"
            ? "Bekreftelsen er sendt. Menigheten behandler overgangen fra G til A."
            : null;

  return (
    <MinSideFrame width="narrow" bottomNavRoom>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            to="/minside"
            aria-label="Tilbake til Min side"
            className="w-11 h-11 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Mitt medlemskap</h1>
        </div>

        {sentMessage && (
          <p className="text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            {sentMessage}
          </p>
        )}
        {gToAPending && (
          <p className="text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Bekreftelsen av voksenmedlemskap (G → A) er sendt og venter på behandling.
          </p>
        )}

        <p className="text-xs text-slate-500 leading-relaxed">{MEMBERSHIP_ARCHIVE_NOTICE}</p>

        <p className="text-sm text-slate-600 leading-relaxed">
          Her ser du om du er medlem i menigheten og i trossamfunnet, slik det står i registeret.
          {settings.email ? (
            <>
              {" "}
              Spørsmål?{" "}
              <a href={`mailto:${settings.email}`} className="font-semibold text-primary-700 hover:underline">
                {settings.email}
              </a>
            </>
          ) : (
            " Spørsmål tas med menigheten."
          )}
        </p>

        <TierCard
          tier={view.congregation}
          headingId="membership-congregation"
          actionTo={
            view.congregation.membershipAction
              ? membershipFormPath(view.congregation.membershipAction, currentUser)
              : undefined
          }
        />
        <TierCard
          tier={view.denomination}
          headingId="membership-denomination"
          actionTo={
            view.denomination.membershipAction
              ? membershipFormPath(view.denomination.membershipAction, currentUser)
              : undefined
          }
          followUpTo={
            view.denomination.followUpAction
              ? membershipFormPath(view.denomination.followUpAction, currentUser)
              : undefined
          }
        />

        {view.groups.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" aria-labelledby="membership-groups">
            <h2 id="membership-groups" className="text-sm font-black text-slate-900">
              Grupper
            </h2>
            <ul className="space-y-2">
              {view.groups.map((row) => (
                <li key={row.groupName} className="text-sm text-slate-800 flex flex-col sm:flex-row sm:justify-between gap-0.5">
                  <span className="font-semibold">{row.groupName}</span>
                  {row.joined && <span className="text-xs text-slate-600">Med siden {row.joined}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </MinSideFrame>
  );
};