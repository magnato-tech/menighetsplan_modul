import { Cake, Mail, Phone, User } from "lucide-react";
import type { ExtraEmail } from "../../../types";
import { ExtraEmailsEditor } from "../../../components/admin/ExtraEmailsEditor";
import { ageOn, birthDateError, formatBirthDate, todayInNorway } from "../../../utils/birthDate";
import { studioDetailCard, studioDetailInput } from "../studioDetailTheme";
import { PersonSaveButton } from "./PersonSaveButton";
import type { Setter } from "./personShared";

interface PersonProfileTabProps {
  name: string;
  setName: Setter<string>;
  phone: string;
  setPhone: Setter<string>;
  email: string;
  setEmail: Setter<string>;
  extraEmails: ExtraEmail[];
  setExtraEmails: Setter<ExtraEmail[]>;
  birthDate: string;
  setBirthDate: Setter<string>;
  justSaved: boolean;
}

// The tab «Profil»: name, phone, e-mail and birth date
export function PersonProfileTab({
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  extraEmails,
  setExtraEmails,
  birthDate,
  setBirthDate,
  justSaved,
}: PersonProfileTabProps) {
  return (
    <div className={studioDetailCard}>
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
        <p className="text-[11px] text-[var(--studio-muted)]">Får all e-post fra menigheten og kan logge inn.</p>
        <div className="pt-2">
          <ExtraEmailsEditor rows={extraEmails} onChange={setExtraEmails} />
        </div>
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

      <PersonSaveButton justSaved={justSaved} />
    </div>
  );
}
