import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { canOpenMyMembership } from "../../../utils/membershipAccess";
import { membershipPageSettings } from "../../../utils/membershipView";
import { validateDenominationChild, type DenominationChildInput } from "../../../utils/membershipApplication";
import { submitMembershipApplication } from "../../../services/membershipApplications";
import { reportWriteError } from "../../../services/writeErrors";
import { fieldClass, labelClass, MembershipFormShell, sectionClass } from "./MembershipFormShell";

export const DenominationChildEnrollPage: React.FC = () => {
  const { currentUser, groups } = useFirebase();
  const { settings } = useCms();
  const navigate = useNavigate();
  const page = membershipPageSettings(settings);

  const [parentNationalId, setParentNationalId] = useState("");
  const [form, setForm] = useState<DenominationChildInput>({
    childLastName: "",
    childFirstNames: "",
    childNationalId: "",
    childBirthPlace: "",
    childBaptized: null,
    childBaptizedDate: "",
    parent1Name: currentUser?.name ?? "",
    parent2Name: "",
    childFromOtherDenomination: false,
    childAttestationAttached: false,
    signaturePlace: "",
    signatureDate: new Date().toISOString().slice(0, 10),
    parent2ConfirmNoOther: false,
    parent2SignaturePlace: "",
    parent2SignatureDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentUser || !canOpenMyMembership(currentUser, groups)) {
    return <Navigate to="/minside" replace />;
  }

  const set = <K extends keyof DenominationChildInput>(key: K, value: DenominationChildInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateDenominationChild(form);
    if (validation) {
      setError(validation);
      return;
    }
    if (!/^\d{11}$/.test(parentNationalId.replace(/\s/g, ""))) {
      setError("Skriv fødselsnummer til forelder 1 (11 siffer).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const parts = form.parent1Name.trim().split(/\s+/);
      const lastName = parts.length > 1 ? parts[parts.length - 1] : form.parent1Name.trim();
      const firstNames = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
      await submitMembershipApplication({
        kind: "denominationChildEnroll",
        personId: currentUser.id,
        congregationName: page.churchName,
        lastName,
        firstNames,
        address: "",
        phone: currentUser.phone ?? "",
        email: currentUser.email ?? "",
        nationalId: parentNationalId.replace(/\s/g, ""),
        baptized: form.childBaptized === true,
        baptizedDate: form.childBaptized ? form.childBaptizedDate : undefined,
        notOtherDenomination: !form.childFromOtherDenomination || form.parent2ConfirmNoOther,
        signaturePlace: form.signaturePlace,
        signatureDate: form.signatureDate,
        childLastName: form.childLastName,
        childFirstNames: form.childFirstNames,
        childNationalId: form.childNationalId.replace(/\s/g, ""),
        childBirthPlace: form.childBirthPlace,
        childBaptized: form.childBaptized === true,
        childBaptizedDate: form.childBaptized ? form.childBaptizedDate : undefined,
        parent2Name: form.parent2Name || undefined,
        childFromOtherDenomination: form.childFromOtherDenomination,
        childAttestationAttached: form.childAttestationAttached,
        parent2ConfirmNoOther: form.parent2ConfirmNoOther,
        parent2SignaturePlace: form.parent2SignaturePlace || undefined,
        parent2SignatureDate: form.parent2SignatureDate || undefined,
      });
      navigate("/minside/medlemskap", { replace: true, state: { membershipSent: "barn" } });
    } catch (err) {
      reportWriteError("sende skjemaet", err);
      setError("Kunne ikke sende skjemaet. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MembershipFormShell
      title="Innmelding av barn i trossamfunnet"
      intro={`Vedlegg til søknad om medlemskap. Barn under 15 år som skal opptas i ${page.denominationName}, meldes inn av foreldre.`}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Barnets navn</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Etternavn</span>
              <input className={fieldClass} value={form.childLastName} onChange={(e) => set("childLastName", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Fornavn/mellomnavn</span>
              <input
                className={fieldClass}
                value={form.childFirstNames}
                onChange={(e) => set("childFirstNames", e.target.value)}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Fødselsnummer (11 siffer)</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                value={form.childNationalId}
                onChange={(e) => set("childNationalId", e.target.value)}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Fødested</span>
              <input
                className={fieldClass}
                value={form.childBirthPlace}
                onChange={(e) => set("childBirthPlace", e.target.value)}
              />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className={labelClass}>Døpt</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.childBaptized === true} onChange={() => set("childBaptized", true)} />
              Ja
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.childBaptized === false} onChange={() => set("childBaptized", false)} />
              Nei
            </label>
            {form.childBaptized && (
              <label className="space-y-1 block pt-1">
                <span className={labelClass}>Dato</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={form.childBaptizedDate}
                  onChange={(e) => set("childBaptizedDate", e.target.value)}
                />
              </label>
            )}
          </fieldset>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Ansvarlige foreldre</h2>
          <label className="space-y-1 block">
            <span className={labelClass}>Fullt navn på forelder 1 (mor/ansvarlig forelder)</span>
            <input className={fieldClass} value={form.parent1Name} onChange={(e) => set("parent1Name", e.target.value)} />
          </label>
          <label className="space-y-1 block">
            <span className={labelClass}>Fødselsnummer forelder 1</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={parentNationalId}
              onChange={(e) => setParentNationalId(e.target.value)}
            />
          </label>
          <label className="space-y-1 block">
            <span className={labelClass}>Fullt navn på forelder 2 (far/ansvarlig forelder)</span>
            <input className={fieldClass} value={form.parent2Name} onChange={(e) => set("parent2Name", e.target.value)} />
          </label>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Fra annet trossamfunn?</h2>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={form.childFromOtherDenomination}
              onChange={(e) => set("childFromOtherDenomination", e.target.checked)}
            />
            Barnet kommer fra annet trossamfunn.
          </label>
          {form.childFromOtherDenomination && (
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form.childAttestationAttached}
                onChange={(e) => set("childAttestationAttached", e.target.checked)}
              />
              Utmeldingsattest for barn fra annet trossamfunn, ligger vedlagt.
            </label>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-black text-slate-900">Signering forelder 1</h2>
          <p className="text-xs text-slate-600">
            Jeg godkjenner at barnet meldes inn i trossamfunnet {page.denominationName}, og bekrefter at barnet ikke er
            medlem i noe annet trossamfunn.
          </p>
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

        {form.parent2Name.trim() && (
          <section className={sectionClass}>
            <h2 className="text-sm font-black text-slate-900">Forelder 2 (valgfritt)</h2>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form.parent2ConfirmNoOther}
                onChange={(e) => set("parent2ConfirmNoOther", e.target.checked)}
              />
              Jeg bekrefter at barnet ikke er medlem i noe annet trossamfunn.
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={labelClass}>Sted</span>
                <input
                  className={fieldClass}
                  value={form.parent2SignaturePlace}
                  onChange={(e) => set("parent2SignaturePlace", e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Dato</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={form.parent2SignatureDate}
                  onChange={(e) => set("parent2SignatureDate", e.target.value)}
                />
              </label>
            </div>
          </section>
        )}

        {error && <p className="text-sm font-semibold text-rose-800">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-white border border-primary-300 px-4 py-3 text-sm font-bold text-primary-900 disabled:opacity-60"
        >
          {busy ? "Sender …" : "Send innmelding for barn"}
        </button>
      </form>
    </MembershipFormShell>
  );
};