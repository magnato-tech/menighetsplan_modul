import { Briefcase, Globe } from "lucide-react";
import type { Person } from "../../../types";
import { toPublicProfile } from "../../../utils/publicProfile";
import { studioDetailCard, studioDetailInput, studioDetailMuted } from "../studioDetailTheme";
import { PersonSaveButton } from "./PersonSaveButton";
import type { Setter, StaffCategory } from "./personShared";

interface PersonWebsiteTabProps {
  person: Person;
  isStaff: boolean;
  setIsStaff: Setter<boolean>;
  staffRole: string;
  setStaffRole: Setter<string>;
  staffCategory: StaffCategory;
  setStaffCategory: Setter<StaffCategory>;
  staffBio: string;
  setStaffBio: Setter<string>;
  avatarUrl: string;
  setAvatarUrl: Setter<string>;
  isPublicProfile: boolean;
  setIsPublicProfile: Setter<boolean>;
  publicTitle: string;
  setPublicTitle: Setter<string>;
  publicPhone: string;
  setPublicPhone: Setter<string>;
  publicEmail: string;
  setPublicEmail: Setter<string>;
  justSaved: boolean;
}

// The tab «Nettside»: staff and the public profile on the website
export function PersonWebsiteTab({
  person,
  isStaff,
  setIsStaff,
  staffRole,
  setStaffRole,
  staffCategory,
  setStaffCategory,
  staffBio,
  setStaffBio,
  avatarUrl,
  setAvatarUrl,
  isPublicProfile,
  setIsPublicProfile,
  publicTitle,
  setPublicTitle,
  publicPhone,
  setPublicPhone,
  publicEmail,
  setPublicEmail,
  justSaved,
}: PersonWebsiteTabProps) {
  return (
    <div className={studioDetailCard}>
      {/* Stab & Ansettelse */}
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
                  onChange={(e) => setStaffCategory(e.target.value as StaffCategory)}
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

      {/* Offentlig profil på nettsiden (krever samtykke) */}
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

      <PersonSaveButton justSaved={justSaved} />
    </div>
  );
}
