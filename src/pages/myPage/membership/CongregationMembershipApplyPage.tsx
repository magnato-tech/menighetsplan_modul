import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { canOpenMyMembership } from "../../../utils/membershipAccess";
import { membershipApplyVariant, membershipPageSettings } from "../../../utils/membershipView";
import {
  splitRegisteredName,
  validateCongregationApply,
  type CongregationApplyInput,
  MEMBERSHIP_DENOMINATION_CHILD_PATH,
} from "../../../utils/membershipApplication";
import { submitMembershipApplication } from "../../../services/membershipApplications";
import { reportWriteError } from "../../../services/writeErrors";
import { fieldClass, labelClass, MembershipFormShell, sectionClass } from "./MembershipFormShell";

const CONGREGATION_INTRO =
  "Medlemskap i menigheten er åpent for mennesker som ved troen på den treenige Gud har tatt imot frelsen i Kristus Jesus, som ønsker å følge Jesus og leve etter Guds ord, og dele fellesskap og ansvar sammen.";

const COMBINED_INTRO =
  "Medlemskap i menighet og trossamfunn er åpent for mennesker som ved troen på den treenige Gud har tatt imot frelsen i Kristus Jesus, og som ønsker å følge Jesus og leve etter Guds ord.";

export const CongregationMembershipApplyPage: React.FC = () => {
  const { currentUser, groups } = useFirebase();
  const { settings } = useCms();
  const navigate = useNavigate();
  const page = membershipPageSettings(settings);
  const prefill = useMemo(() => splitRegisteredName(currentUser?.name ?? ""), [currentUser?.name]);

  const [form, setForm] = useState<CongregationApplyInput>({
    lastName: prefill.lastName,
    firstNames: prefill.firstNames,
    address: "",
    phone: currentUser?.phone ?? "",
    email: currentUser?.email ?? "",
    nationalId: "",
    baptized: null,
    baptizedDate: "",
    alsoDenomination: false,
    notOtherDenomination: false,
    childrenToEnroll: false,
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentUser || !canOpenMyMembership(currentUser, groups)) {
    return <Navigate to="/minside" replace />;
  }
  const variant = membershipApplyVariant(currentUser);
  if (variant !== "combined" && variant !== "congregationOnly") {
    return <Navigate to="/minside/medlemskap" replace />;
  }

  const combined = variant === "combined";
  const alreadyDenominationMember = currentUser.denominationMember === true;
  const title = combined
    ? "Søknad om medlemskap i menighet og trossamfunn"
    : "Søknad om medlemskap i menigheten";
  const intro = combined ? COMBINED_INTRO : CONGREGATION_INTRO;

  const set = <K extends keyof CongregationApplyInput>(key: K, value: CongregationApplyInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateCongregationApply(form, {
      requireBaptizedDate: true,
      alreadyDenominationMember,
      enrollingInDenomination: combined && form.alsoDenomination,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await submitMembershipApplication({
        kind: "congregationApply",
        personId: currentUser.id,
        congregationName: page.churchName,
        lastName: form.lastName,
        firstNames: form.firstNames,
        address: form.address,
        phone: form.phone,
        email: form.email,
        nationalId: form.nationalId,
        baptized: form.baptized === true,
        baptizedDate: form.baptized ? form.baptizedDate : undefined,
        alsoDenomination: combined && form.alsoDenomination,
        childrenToEnroll: form.childrenToEnroll,
        notOtherDenomination: form.notOtherDenomination,
        signaturePlace: form.signaturePlace,
        signatureDate: form.signatureDate,
      });
      navigate("/minside/medlemskap", {
        replace: true,
        state: {
          membershipSent: form.childrenToEnroll ? "soknad-barn" : "soknad",
        },
      });
    } catch (err) {
      reportWriteError("sende søknaden", err);
      setError("Kunne ikke sende søknaden. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MembershipFormShell title={title} intro={intro}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Om deg</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Etternavn</span>
              <input className={fieldClass} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Fornavn/mellomnavn</span>
              <input className={fieldClass} value={form.firstNames} onChange={(e) => set("firstNames", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Adresse</span>
              <input className={fieldClass} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Mobiltelefon</span>
              <input className={fieldClass} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>E-post</span>
              <input className={fieldClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Fødselsnummer (11 siffer)</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                autoComplete="off"
                value={form.nationalId}
                onChange={(e) => set("nationalId", e.target.value)}
              />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className={labelClass}>Døpt</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.baptized === true} onChange={() => set("baptized", true)} />
              Ja
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.baptized === false} onChange={() => set("baptized", false)} />
              Nei
            </label>
            {form.baptized && (
              <label className="space-y-1 block pt-1">
                <span className={labelClass}>Dato</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={form.baptizedDate}
                  onChange={(e) => set("baptizedDate", e.target.value)}
                />
              </label>
            )}
          </fieldset>
        </section>

        <section className={sectionClass}>
          <p className="text-sm text-slate-800">
            Jeg søker om å bli medlem i <span className="font-semibold">{page.churchName}</span>.
          </p>
          {combined && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form.alsoDenomination}
                onChange={(e) => set("alsoDenomination", e.target.checked)}
              />
              Jeg ønsker å bli medlem i trossamfunnet {page.denominationName}.
            </label>
          )}
          {!alreadyDenominationMember && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form.notOtherDenomination}
                onChange={(e) => set("notOtherDenomination", e.target.checked)}
              />
              Jeg bekrefter at jeg ikke er medlem i et annet trossamfunn.
            </label>
          )}
          {combined && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form.childrenToEnroll}
                onChange={(e) => set("childrenToEnroll", e.target.checked)}
              />
              Jeg har foreldreansvar til barn under 15 år som skal meldes inn i trossamfunnet. Signert skjema for barn
              vedlegges.
            </label>
          )}
          {combined && form.childrenToEnroll && (
            <p className="text-xs text-slate-600">
              Etter innsending kan du fylle ut{" "}
              <Link to={MEMBERSHIP_DENOMINATION_CHILD_PATH} className="font-semibold text-primary-700 hover:underline">
                skjema for barn
              </Link>
              .
            </p>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Signatur</h2>
          <p className="text-xs text-slate-600">Ved å sende inn bekrefter du opplysningene over.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className={labelClass}>Sted</span>
              <input className={fieldClass} value={form.signaturePlace} onChange={(e) => set("signaturePlace", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Dato</span>
              <input
                className={fieldClass}
                type="date"
                value={form.signatureDate}
                onChange={(e) => set("signatureDate", e.target.value)}
              />
            </label>
          </div>
        </section>

        {error && <p className="text-sm font-semibold text-rose-800">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Sender …" : "Send søknad"}
        </button>
      </form>
    </MembershipFormShell>
  );
};