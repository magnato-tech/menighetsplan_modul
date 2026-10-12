import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../../context/CmsContext";
import { CmsSettings } from "../../../data/cmsData";
import {
  MapPin,
  Building2,
  Heart,
  Save,
  Palette,
  ArrowRight,
  AlertCircle,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { logoFileError, logoOf } from "../../../utils/logo";

export const SiteSettingsTab: React.FC = () => {
  const { settings, saveSettings } = useCms();

  const [settingsForm, setSettingsForm] = useState<CmsSettings>({ ...settings });

  useEffect(() => {
    setSettingsForm({ ...settings });
  }, [settings]);

  // The logo is read from the file and kept in the form as text. It is stored with the rest when the form is saved.
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const chooseLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const error = logoFileError(file);
    setLogoError(error);
    if (error) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSettingsForm((form) => ({ ...form, logoUrl: reader.result as string }));
    };
    reader.onerror = () => setLogoError("Filen kunne ikke leses. Prøv igjen.");
    reader.readAsDataURL(file);
  };
  const logo = logoOf(settingsForm);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(settingsForm);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[var(--studio-border)] pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Nettside-innstillinger</h2>
        <p className="text-xs text-[var(--studio-muted)]">
          Oppdater menighetens faste informasjon, Vipps-nummer, bankkonto, adresse og sosiale medier.
        </p>
      </div>

      {/* Design System Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-accent-border)] flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-[var(--studio-icon)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--studio-text)] text-sm">Menighetens Designsystem & Fargetema</h3>
            <p className="text-xs text-[var(--studio-muted)] mt-0.5">
              Globale fargeprofiler, typografi, overflater og spacing administreres sentralt under fanen «Tema & Designsystem».
            </p>
          </div>
        </div>
        <Link
          to="/admin?tab=cms-design"
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
        >
          <span>Åpne Tema & Design</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Menighet & Merkevare */}
        <div className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
          <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--studio-icon)]" />
            <span>Menighet & Merkevare</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Menighetens offisielle navn</label>
              <input
                type="text"
                value={settingsForm.churchName}
                onChange={(e) => setSettingsForm({ ...settingsForm, churchName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Plattformnavn</label>
              <input
                type="text"
                value={settingsForm.appName}
                onChange={(e) => setSettingsForm({ ...settingsForm, appName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <p className="font-semibold text-[var(--studio-muted)]">Logo</p>
            <p className="text-[var(--studio-muted)]">
              Vises øverst på nettsiden og på innloggingssiden, i stedet for navnet. Bruk en liggende logo i PNG eller SVG, på lys bakgrunn.
            </p>
            {logo && (
              <div className="inline-flex items-center rounded-xl bg-white border border-[var(--studio-border)] px-4 py-3">
                <img src={logo} alt={`Logoen til ${settingsForm.churchName}`} className="h-12 w-auto max-w-full object-contain" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input ref={logoInput} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={chooseLogo} aria-label="Logofil" className="sr-only" />
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                className="px-3 py-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-input)] text-[var(--studio-text)] font-bold flex items-center gap-2 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>{logo ? "Bytt logo" : "Velg logo"}</span>
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoError(null);
                    setSettingsForm({ ...settingsForm, logoUrl: undefined });
                  }}
                  className="px-3 py-2 rounded-xl border border-[var(--studio-border)] text-[var(--studio-muted)] font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Fjern logoen</span>
                </button>
              )}
            </div>
            {logoError && (
              <p role="alert" className="flex items-center gap-1.5 font-semibold text-rose-500">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{logoError}</span>
              </p>
            )}
            {logo !== logoOf(settings) && !logoError && <p className="text-[var(--studio-muted)]">Trykk «Lagre alle innstillinger» nederst for å ta endringen i bruk.</p>}
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-[var(--studio-muted)]">Slagord / Visjon</label>
            <input
              type="text"
              value={settingsForm.tagline}
              onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-[var(--studio-muted)]">Hovedoverskrift på forsiden (Hero)</label>
            <input
              type="text"
              value={settingsForm.welcomeHeadline}
              onChange={(e) => setSettingsForm({ ...settingsForm, welcomeHeadline: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-[var(--studio-muted)]">Ingresstekst på forsiden</label>
            <textarea
              rows={2}
              value={settingsForm.welcomeSubtext}
              onChange={(e) => setSettingsForm({ ...settingsForm, welcomeSubtext: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
            />
          </div>
        </div>

        {/* Gaver & Vipps */}
        <div className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
          <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <span>Givertjeneste & Vipps</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Vipps-nummer</label>
              <input
                type="text"
                value={settingsForm.vippsNumber}
                onChange={(e) => setSettingsForm({ ...settingsForm, vippsNumber: e.target.value })}
                placeholder="#12345"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-amber-300 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Bankkontonummer</label>
              <input
                type="text"
                value={settingsForm.bankAccount}
                onChange={(e) => setSettingsForm({ ...settingsForm, bankAccount: e.target.value })}
                placeholder="1503.xx.xxxxx"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Organisasjonsnummer</label>
              <input
                type="text"
                value={settingsForm.orgNumber}
                onChange={(e) => setSettingsForm({ ...settingsForm, orgNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
          </div>
        </div>

        {/* Kontaktinformasjon & Adresse */}
        <div className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
          <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Adresse & Kontakt</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Besøksadresse</label>
              <input
                type="text"
                value={settingsForm.address}
                onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Telefon</label>
              <input
                type="text"
                value={settingsForm.phone}
                onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">E-post</label>
              <input
                type="email"
                value={settingsForm.email}
                onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Kontortid</label>
              <input
                type="text"
                value={settingsForm.officeHours}
                onChange={(e) => setSettingsForm({ ...settingsForm, officeHours: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Lagre alle innstillinger</span>
          </button>
        </div>
      </form>
    </div>
  );
};
