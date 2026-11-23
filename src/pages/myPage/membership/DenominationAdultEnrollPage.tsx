import React, { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { canOpenMyMembership } from "../../../utils/membershipAccess";
import { membershipApplyVariant, membershipPageSettings } from "../../../utils/membershipView";
import { MEMBERSHIP_CONGREGATION_APPLY_PATH } from "../../../utils/membershipApplication";
import {
  canSelfSubmitDenominationAdult,
  splitRegisteredName,
  validateDenominationAdult,
  type DenominationAdultInput,
  MEMBERSHIP_DENOMINATION_CHILD_PATH,
} from "../../../utils/membershipApplication";
import { submitMembershipApplication } from "../../../services/membershipApplications";
import { reportWriteError } from "../../../services/writeErrors";
import { Link } from "react-router-dom";
import { fieldClass, labelClass, MembershipFormShell, sectionClass } from "./MembershipFormShell";

export const DenominationAdultEnrollPage: React.FC = () => {
  const { currentUser, groups } = useFirebase();
  const { settings } = useCms();
  const navigate = useNavigate();
  const page = membershipPageSettings(settings);
  const prefill = useMemo(() => splitRegisteredName(currentUser?.name ?? ""), [currentUser?.name]);

  const [form, setForm] = useState<DenominationAdultInput>({
    lastName: prefill.lastName,
    firstNames: prefill.firstNames,
    address: "",
    phone: currentUser?.phone ?? "",
    email: currentUser?.email ?? "",
    nationalId: "",
    baptized: null,
    baptizedDate: "",
    notOtherDenomination: false,
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentUser || !canOpenMyMembership(currentUser, groups)) {
    return <Navigate to="/minside" replace />;
  }
  const variant = membershipApplyVariant(currentUser);
  if (variant === null) {
    return <Navigate to="/minside/medlemskap" replace />;
  }
  if (variant === "combined" || variant === "congregationOnly") {
    return <Navigate to={MEMBERSHIP_CONGREGATION_APPLY_PATH} replace />;
  }

  if (!canSelfSubmitDenominationAdult(currentUser.birthDate)) {
    return (
      <MembershipFormShell
        title="Innmelding i trossamfunnet"
        intro={`Barn under 15 år meldes inn av foreldre. Be en forelder medlem i ${page.churchName} om å sende inn skjemaet.`}
      >
        <Link
          to={MEMBERSHIP_DENOMINATION_CHILD_PATH}
          className="block w-full rounded-xl border border-primary-300 bg-white px-4 py-3 text-center text-sm font-bold text-primary-900"
        >
          Skjema for barn (foreldre)
        </Link>
      </MembershipFormShell>
    );
  }

  const set = <K extends keyof DenominationAdultInput>(key: K, value: DenominationAdultInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateDenominationAdult(form);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await submitMembershipApplication({
        kind: "denominationAdultEnroll",
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
        alsoDenomination: true,
        notOtherDenomination: form.notOtherDenomination,
        signaturePlace: form.signaturePlace,
        signatureDate: form.signatureDate,
      });
      navigate("/minside/medlemskap", { replace: true, state: { membershipSent: "innmelding" } });
    } catch (err) {
      reportWriteError("sende innmeldingen", err);
      setError("Kunne ikke sende innmeldingen. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MembershipFormShell
      title="Innmelding i trossamfunnet"
      intro={`Du melder deg inn i ${page.denominationName}.`}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <section className={sectionClass}>
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
            Jeg ønsker å bli medlem i trossamfunnet <span className="font-semibold">{page.denominationName}</span>.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={form.notOtherDenomination}
              onChange={(e) => set("notOtherDenomination", e.target.checked)}
            />
            Jeg bekrefter at jeg ikke er medlem i et annet trossamfunn.
          </label>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Signatur</h2>
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
          className="w-full rounded-xl bg-white border border-primary-300 px-4 py-3 text-sm font-bold text-primary-900 disabled:opacity-60"
        >
          {busy ? "Sender …" : "Send innmelding"}
        </button>
      </form>
    </MembershipFormShell>
  );
};