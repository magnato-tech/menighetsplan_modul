import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdminDetailRoute } from "../utils/adminStudioRoutes";
import { useAdminPersonDetail } from "../hooks/useAppHooks";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { StudioDetailShell, StudioDetailNotFound } from "./admin/StudioDetailShell";
import {
  studioDetailCard,
  studioDetailSection,
  studioDetailInput,
  studioDetailMuted,
  studioDetailTitle,
  studioDetailLink,
  studioDetailRow,
  studioPrimaryButton,
} from "./admin/studioDetailTheme";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { toPublicProfile, publicProfileFields } from "../utils/publicProfile";
import { compressImageFile } from "../utils/imageUpload";
import { ageOn, birthDateError, formatBirthDate, todayInNorway } from "../utils/birthDate";
import {
  Globe,
  User,
  Phone,
  Mail,
  Users,
  UserCheck,
  UserCog,
  Save,
  CheckSquare,
  BadgeCheck,
  CalendarX,
  Plus,
  Trash2,
  Shield,
  Camera,
  Briefcase,
  Cake,
} from "lucide-react";

export const AdminPersonDetailPage: React.FC = () => {
  const detailRoute = useAdminDetailRoute();
  const personId = detailRoute?.kind === "person" ? detailRoute.id : "";

  const {
    isAdmin,
    currentUser,
    person,
    personGroups,
    personTasks,
    updatePerson,
  } = useAdminPersonDetail(personId || "");

  // Form states
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [globalRole, setGlobalRole] = useState<"member" | "admin">("member");
  const [policeCert, setPoliceCert] = useState<string>("");
  const [unavailablePeriods, setUnavailablePeriods] = useState<{ from: string; to: string; reason?: string }[]>([]);
  const [newUnavailFrom, setNewUnavailFrom] = useState<string>("");
  const [newUnavailTo, setNewUnavailTo] = useState<string>("");
  const [newUnavailReason, setNewUnavailReason] = useState<string>("");
  const [isPublicProfile, setIsPublicProfile] = useState<boolean>(false);
  const [publicTitle, setPublicTitle] = useState<string>("");
  const [publicPhone, setPublicPhone] = useState<string>("");
  const [publicEmail, setPublicEmail] = useState<string>("");
  // Stabs- og bildefelter
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isStaff, setIsStaff] = useState<boolean>(false);
  const [staffRole, setStaffRole] = useState<string>("");
  const [staffCategory, setStaffCategory] = useState<"pastor" | "stab" | "barneleder" | "diakoni" | "annet">("stab");
  const [staffBio, setStaffBio] = useState<string>("");

  const [feedback, setFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();

  useEffect(() => {
    if (person) {
      setName(person.name);
      setPhone(person.phone || "");
      setEmail(person.email || "");
      setBirthDate(person.birthDate || "");
      setGlobalRole(person.globalRole || "member");
      setPoliceCert(person.policeCertificateValidUntil || "");
      setUnavailablePeriods(person.unavailablePeriods || []);
      setIsPublicProfile(toPublicProfile(person) !== null);
      setPublicTitle(person.publicTitle || "");
      setPublicPhone(person.publicPhone || "");
      setPublicEmail(person.publicEmail || "");
      setAvatarUrl(person.avatarUrl || "");
      setIsStaff(Boolean(person.isStaff));
      setStaffRole(person.staffRole || person.publicTitle || "");
      setStaffCategory(person.staffCategory || "stab");
      setStaffBio(person.staffBio || "");
    }
  }, [person]);

  const showFeedback = (text: string, type: "success" | "error" = "success") => setFeedback({ text, type });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, { maxDimension: 500, quality: 0.85 });
      setAvatarUrl(dataUrl);
      showFeedback("Portrettbilde klargjort! Husk å trykke lagre.");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Kunne ikke laste bilde.", "error");
    }
  };

  const handleAddUnavailablePeriod = () => {
    if (!newUnavailFrom || !newUnavailTo) {
      showFeedback("Både fra- og til-dato må oppgis for fravær.", "error");
      return;
    }
    const updated = [
      ...unavailablePeriods,
      {
        from: newUnavailFrom,
        to: newUnavailTo,
        reason: newUnavailReason.trim() || undefined,
      },
    ];
    setUnavailablePeriods(updated);
    setNewUnavailFrom("");
    setNewUnavailTo("");
    setNewUnavailReason("");
    showFeedback("Fraværsperiode lagt til!");
  };

  const handleRemoveUnavailablePeriod = (idx: number) => {
    setUnavailablePeriods(unavailablePeriods.filter((_, i) => i !== idx));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!person) return;

    if (!name.trim()) {
      showFeedback("Navn kan ikke være tomt.", "error");
      return;
    }

    const wrongBirthDate = birthDateError(birthDate);
    if (wrongBirthDate) {
      showFeedback(wrongBirthDate, "error");
      return;
    }

    const res = updatePerson(person.id, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      birthDate: birthDate || undefined,
      globalRole,
      avatarUrl: avatarUrl.trim() || undefined,
      isStaff,
      staffRole: staffRole.trim() || undefined,
      staffCategory,
      staffBio: staffBio.trim() || undefined,
      policeCertificateValidUntil: policeCert || undefined,
      unavailablePeriods,
      ...publicProfileFields(
        person,
        {
          isPublic: isPublicProfile || isStaff,
          title: (staffRole || publicTitle).trim(),
          phone: publicPhone,
          email: publicEmail,
        },
        currentUser.id
      ),
    });

    if (res.success) {
      showFeedback("Personopplysninger og tilganger ble lagret!");
    } else {
      showFeedback(res.error || "Kunne ikke lagre person.", "error");
    }
  };

  // Friendly access denied screen if user is not admin
  if (!isAdmin) {
    return <AdminAccessRequired target="personkort i admin-flaten" />;
  }

  if (!person) {
    return (
      <StudioDetailNotFound
        backTab="planlegger-personer"
        backLabel="Tilbake til personregister"
        title="Fant ikke personen"
      />
    );
  }

  return (
    <StudioDetailShell
      backTab="planlegger-personer"
      backLabel="Tilbake til personregister"
      badge="Personkort"
      feedback={feedback}
    >
      <div className="space-y-5">
        {/* Main Person Edit Card */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className={studioDetailCard}>
            {/* Header info with Avatar */}
            <div className="flex items-start justify-between border-b border-[var(--studio-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={person.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex items-center justify-center text-indigo-700 font-bold text-base">
                      {person.name.charAt(0)}
                    </div>
                  )}
                  <label
                    htmlFor="input-avatar-upload"
                    className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full cursor-pointer shadow-xs"
                    title="Last opp portrettbilde"
                  >
                    <Camera className="w-3 h-3" />
                  </label>
                  <input
                    type="file"
                    id="input-avatar-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <h3 className={studioDetailTitle}>{person.name}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--studio-muted)]">
                    {staffRole ? (
                      <span className="font-semibold text-indigo-600">{staffRole}</span>
                    ) : (
                      <span>{person.email || "Ingen e-post"}</span>
                    )}
                  </div>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  person.globalRole === "admin"
                    ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    : "bg-slate-100 text-[var(--studio-text)] border border-[var(--studio-border)]"
                }`}
              >
                {person.globalRole === "admin" ? "Global Admin" : "Medlem (member)"}
              </span>
            </div>

            {/* 1. Navn */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-person-name"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Fullt navn:
              </label>
              <input
                type="text"
                id="input-edit-person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Kari Nordmann..."
                className={studioDetailInput}
              />
            </div>

            {/* 2. Mobil */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-person-phone"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                Mobilnummer:
              </label>
              <input
                type="tel"
                id="input-edit-person-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="F.eks. 912 34 567"
                className={studioDetailInput}
              />
            </div>

            {/* 3. E-post */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-person-email"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                E-postadresse:
              </label>
              <input
                type="email"
                id="input-edit-person-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="F.eks. kari@eksempel.no"
                className={studioDetailInput}
              />
            </div>

            {/* Fødselsdato */}
            <div className="space-y-1.5">
              <label htmlFor="input-edit-person-birthdate" className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5">
                <Cake className="w-3.5 h-3.5 text-indigo-600" />
                Fødselsdato:
              </label>
              <input
                type="date"
                id="input-edit-person-birthdate"
                value={birthDate}
                max={todayInNorway()}
                onChange={(e) => setBirthDate(e.target.value)}
                className={studioDetailInput}
              />
              <p className="text-[11px] text-[var(--studio-muted)]">
                {birthDateError(birthDate) ??
                  (ageOn(birthDate) !== null
                    ? `Født ${formatBirthDate(birthDate)}, ${ageOn(birthDate)} år. Vises ikke på nettsiden.`
                    : "Valgfritt. Vises ikke på nettsiden.")}
              </p>
            </div>

            {/* 4. Global Rolle (Sikrer støtte for flere co-admins) */}
            <div className="space-y-1.5 pt-1 border-t border-[var(--studio-border)]">
              <label
                htmlFor="select-edit-person-role"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  Global systemrolle:
                </span>
                <span className="text-[10px] text-[var(--studio-muted)] font-normal">
                  (Muliggjør 2+ likestilte administratorer)
                </span>
              </label>
              <select
                id="select-edit-person-role"
                value={globalRole}
                onChange={(e) => setGlobalRole(e.target.value as "member" | "admin")}
                className={studioDetailInput}
              >
                <option value="member">Medlem / Frivillig (standard tilgang)</option>
                <option value="admin">Administrator (full tilgang til Admin Studio & CMS)</option>
              </select>
            </div>

            {/* 5. Politiattest for barne- og ungdomsarbeid */}
            <div className="space-y-1.5 pt-1 border-t border-[var(--studio-border)]">
              <label
                htmlFor="input-edit-person-police"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Politiattest (gyldig til dato):
                </span>
                {policeCert ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Registrert ({policeCert})
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--studio-muted)] font-normal">Ikke registrert</span>
                )}
              </label>
              <input
                type="date"
                id="input-edit-person-police"
                value={policeCert}
                onChange={(e) => setPoliceCert(e.target.value)}
                className={studioDetailInput}
              />
              <p className={studioDetailMuted}>
                Påkrevd for frivillige som arbeider med mindreårige (søndagsskole og barneleir).
              </p>
            </div>

            {/* 6. Utilgjengelighetskalender ("Borte fra–til") */}
            <div className="space-y-2 pt-2 border-t border-[var(--studio-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5">
                  <CalendarX className="w-3.5 h-3.5 text-amber-600" />
                  Utilgjengelig / Bortreist:
                </span>
                <span className="text-[10px] text-[var(--studio-muted)]">
                  {unavailablePeriods.length} perioder registrert
                </span>
              </div>

              {unavailablePeriods.length > 0 && (
                <div className="space-y-1.5 bg-[var(--studio-row)] p-2.5 rounded-xl border border-[var(--studio-border)]">
                  {unavailablePeriods.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2 bg-[var(--studio-row)] rounded-lg border border-[var(--studio-border)] text-slate-200"
                    >
                      <div>
                        <strong className="text-white">
                          {p.from} til {p.to}
                        </strong>
                        {p.reason && <span className="text-[var(--studio-muted)] ml-1.5">({p.reason})</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnavailablePeriod(idx)}
                        className="text-rose-500 hover:text-rose-700 text-[11px] p-1 cursor-pointer"
                        title="Fjern fraværsperiode"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Period Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <input
                  type="date"
                  value={newUnavailFrom}
                  onChange={(e) => setNewUnavailFrom(e.target.value)}
                  placeholder="Fra dato"
                  className={studioDetailInput}
                />
                <input
                  type="date"
                  value={newUnavailTo}
                  onChange={(e) => setNewUnavailTo(e.target.value)}
                  placeholder="Til dato"
                  className={studioDetailInput}
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newUnavailReason}
                    onChange={(e) => setNewUnavailReason(e.target.value)}
                    placeholder="Årsak (f.eks. Ferie)"
                    className="w-full className={studioDetailInput}"
                  />
                  <button
                    type="button"
                    onClick={handleAddUnavailablePeriod}
                    className="px-2 py-1.5 bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-white rounded-lg shrink-0 cursor-pointer"
                    title="Legg til fravær"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 7. Stab & Ansettelse */}
            <div className="space-y-3 pt-3 border-t border-[var(--studio-border)] bg-[var(--studio-accent-bg)] p-3.5 rounded-2xl border border-[var(--studio-accent-border)]/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  Stab & Ansettelse:
                </span>
                {isStaff ? (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                    Ansatt i staben
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--studio-muted)] font-normal">Frivillig / Ikke stab</span>
                )}
              </div>

              <label htmlFor="input-edit-person-is-staff" className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="input-edit-person-is-staff"
                  checked={isStaff}
                  onChange={(e) => {
                    setIsStaff(e.target.checked);
                    if (e.target.checked && !isPublicProfile) {
                      setIsPublicProfile(true);
                    }
                  }}
                  className="w-4 h-4 mt-0.5 border border-slate-300 rounded-md cursor-pointer accent-indigo-600"
                />
                <span className="text-[11px] font-semibold text-slate-200">
                  Personen er ansatt i staben og kan vises i stabsseksjoner på nettsiden
                </span>
              </label>

              {isStaff && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)]">
                        Stillingstittel utad
                      </label>
                      <input
                        type="text"
                        value={staffRole}
                        onChange={(e) => setStaffRole(e.target.value)}
                        placeholder="f.eks. Hovedpastor, Daglig leder..."
                        className={studioDetailInput}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)]">
                        Kategori
                      </label>
                      <select
                        value={staffCategory}
                        onChange={(e) => setStaffCategory(e.target.value as any)}
                        className={studioDetailInput}
                      >
                        <option value="pastor">Pastor / Forkynner</option>
                        <option value="stab">Administrasjon & Ledelse</option>
                        <option value="barneleder">Barn & Ungdom</option>
                        <option value="diakoni">Diakoni & Omsorg</option>
                        <option value="annet">Annet</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)]">
                      Kort bio / introduksjon for nettsiden
                    </label>
                    <textarea
                      rows={2}
                      value={staffBio}
                      onChange={(e) => setStaffBio(e.target.value)}
                      placeholder="Skriv 1-3 setninger om personens ansvarsområde eller bakgrunn..."
                      className={studioDetailInput}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)] shrink-0">
                      Bilde-URL:
                    </label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://... eller bruk kamerasymbolet øverst"
                      className={studioDetailInput}
                    />
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl("")}
                        className="text-rose-500 hover:text-rose-700 text-xs px-1 cursor-pointer"
                        title="Fjern bilde"
                      >
                        Fjern
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 8. Offentlig profil på nettsiden (krever samtykke) */}
            <div className="space-y-2 pt-2 border-t border-[var(--studio-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  Offentlig profil på nettsiden:
                </span>
                {toPublicProfile(person) ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Vises offentlig
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--studio-muted)] font-normal">Vises ikke</span>
                )}
              </div>

              <label htmlFor="input-edit-person-public" className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="input-edit-person-public"
                  checked={isPublicProfile}
                  onChange={(e) => setIsPublicProfile(e.target.checked)}
                  className="w-4 h-4 mt-0.5 border border-slate-300 rounded-md cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-[var(--studio-muted)]">
                  Personen har samtykket til å stå med navn på den offentlige nettsiden
                </span>
              </label>

              {person.consentToPublishGivenAt && (
                <p className={studioDetailMuted}>
                  Samtykke registrert {new Date(person.consentToPublishGivenAt).toLocaleDateString("no-NO")}.
                </p>
              )}

              {isPublicProfile && (
                <div className="space-y-2 bg-[var(--studio-row)] p-2.5 rounded-xl border border-[var(--studio-border)]">
                  <input
                    type="text"
                    id="input-edit-person-public-title"
                    aria-label="Tittel utad"
                    value={publicTitle}
                    onChange={(e) => setPublicTitle(e.target.value)}
                    placeholder="Tittel utad, f.eks. Hovedpastor"
                    className={studioDetailInput}
                  />
                  <input
                    type="tel"
                    id="input-edit-person-public-phone"
                    aria-label="Telefon utad"
                    value={publicPhone}
                    onChange={(e) => setPublicPhone(e.target.value)}
                    placeholder="Telefon utad (valgfritt)"
                    className={studioDetailInput}
                  />
                  <input
                    type="email"
                    id="input-edit-person-public-email"
                    aria-label="E-post utad"
                    value={publicEmail}
                    onChange={(e) => setPublicEmail(e.target.value)}
                    placeholder="E-post utad (valgfritt)"
                    className={studioDetailInput}
                  />
                  <p className={studioDetailMuted}>
                    Bare navnet og disse feltene vises utad. Privat mobilnummer og e-postadresse publiseres aldri.
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-3">
              <button
                type="submit"
                id="btn-save-person-detail"
                className={studioPrimaryButton}
              >
                <Save className="w-4 h-4" />
                Lagre alle personopplysninger & tilganger
              </button>
            </div>
          </div>
        </form>

        {/* Roles and Group Memberships */}
        <section
          id="person-groups-section"
          className={studioDetailSection}
        >
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
            <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[var(--studio-muted)]" />
              Gruppetilhørighet ({personGroups.length})
            </span>
          </div>

          {personGroups.length === 0 ? (
            <p className="text-xs text-[var(--studio-muted)] italic py-2">
              Personen er ikke medlem av noen grupper ennå.
            </p>
          ) : (
            <div className="space-y-2">
              {personGroups.map((group) => {
                const isLeader = group.leaderIds.includes(person.id);
                const isDeputy = group.deputyLeaderIds?.includes(person.id);

                return (
                  <div
                    key={group.id}
                    className={studioDetailRow}
                  >
                    <div>
                      <Link
                        to={`/admin/gruppe/${group.id}`}
                        className={`${studioDetailLink} transition-colors`}
                      >
                        {group.name}
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isLeader && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          Leder
                        </span>
                      )}
                      {isDeputy && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                          <UserCog className="w-3 h-3" />
                          Nestleder
                        </span>
                      )}
                      {!isLeader && !isDeputy && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-[var(--studio-text)]">
                          Medlem
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Assigned Tasks Summary */}
        <section
          id="person-tasks-section"
          className={studioDetailSection}
        >
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
            <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              Tildelte oppgaver ({personTasks.length})
            </span>
            <span className="text-[10px] text-[var(--studio-muted)] font-medium">Assignment</span>
          </div>

          {personTasks.length === 0 ? (
            <p className="text-xs text-[var(--studio-muted)] italic py-1">
              Ingen aktive oppgaver tildelt denne personen for øyeblikket.
            </p>
          ) : (
            <div className="space-y-1.5 pt-1">
              {personTasks.map((task) => (
                <div
                  key={task.id}
                  className={studioDetailRow}
                >
                  <span className="text-slate-200 font-medium">{task.title}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      task.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : task.status === "vacant"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {task.status === "confirmed" ? "Bekreftet" : task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudioDetailShell>
  );
};
