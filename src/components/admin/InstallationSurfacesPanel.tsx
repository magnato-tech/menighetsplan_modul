import React, { useEffect, useState } from "react";
import { Globe, LayoutDashboard, Loader2 } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { icalImportOn, normalizeExternalCalendarUrl } from "../../utils/surfaces";
import type { ShowFeedback } from "../../pages/admin/studio";
import { studioSecondaryButton } from "../../pages/admin/studioTheme";

interface InstallationSurfacesPanelProps {
  showFeedback: ShowFeedback;
}

/**
 * Which flat surfaces are on: Min side and our public website. When our website is off, the congregation's
 * own address is used for links and optional iCal import (see utils/surfaces.ts).
 */
export const InstallationSurfacesPanel: React.FC<InstallationSurfacesPanelProps> = ({ showFeedback }) => {
  const { surfaces, surfacesState, saveSurfaces } = useCms();
  const [minSide, setMinSide] = useState(surfaces.minSide);
  const [ownWebsite, setOwnWebsite] = useState(surfaces.ownWebsite);
  const [externalSiteUrl, setExternalSiteUrl] = useState(surfaces.externalSiteUrl);
  const [externalCalendarUrl, setExternalCalendarUrl] = useState(surfaces.externalCalendarUrl);
  const [importNewAutomatically, setImportNewAutomatically] = useState(surfaces.importNewAutomatically);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setMinSide(surfaces.minSide);
    setOwnWebsite(surfaces.ownWebsite);
    setExternalSiteUrl(surfaces.externalSiteUrl);
    setExternalCalendarUrl(surfaces.externalCalendarUrl);
    setImportNewAutomatically(surfaces.importNewAutomatically);
  }, [surfaces]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ownWebsite && !externalSiteUrl.trim()) {
      showFeedback("Legg inn menighetens nettside når vår nettside er av.", "error");
      return;
    }
    const calendarUrl = normalizeExternalCalendarUrl(externalCalendarUrl);
    setWorking(true);
    const ok = await saveSurfaces({
      minSide,
      ownWebsite,
      externalSiteUrl: externalSiteUrl.trim(),
      externalCalendarUrl: calendarUrl,
      importNewAutomatically,
    });
    setWorking(false);
    if (ok) showFeedback("Flatene er lagret.");
    else showFeedback("Flatene ble ikke lagret.", "error");
  };

  const importHint = icalImportOn({
    ...surfaces,
    ownWebsite,
    externalSiteUrl: externalSiteUrl.trim(),
    externalCalendarUrl: externalCalendarUrl.trim(),
  });

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
      <div>
        <h3 className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-400" />
          <span>Flater i løsningen</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] mt-1">
          Slå av en flate når menigheten ikke skal bruke den. Innholdet i databasen slettes ikke.
        </p>
      </div>

      {surfacesState === "loading" ? (
        <p className="text-xs text-[var(--studio-muted)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Laster innstillinger…
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={minSide}
              onChange={(e) => setMinSide(e.target.checked)}
              className="mt-1 rounded border-[var(--studio-border)]"
            />
            <span>
              <span className="block text-sm font-bold text-[var(--studio-text)] flex items-center gap-1.5">
                <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                Min side
              </span>
              <span className="block text-xs text-[var(--studio-muted)] mt-0.5">
                Frivillige og gruppeledere bruker Min side og lederflaten. Avslått sendes administrator til admin ved innlogging.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ownWebsite}
              onChange={(e) => setOwnWebsite(e.target.checked)}
              className="mt-1 rounded border-[var(--studio-border)]"
            />
            <span>
              <span className="block text-sm font-bold text-[var(--studio-text)]">Vår nettside</span>
              <span className="block text-xs text-[var(--studio-muted)] mt-0.5">
                Når den er av, vises ikke sidene dere lager her på menighetens egen nettside. Forsiden peker til adressen under.
              </span>
            </span>
          </label>

          {!ownWebsite && (
            <div className="space-y-3 pl-7 border-l-2 border-[var(--studio-border)]">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[var(--studio-text)]">Menighetens nettside (https)</span>
                <input
                  type="url"
                  value={externalSiteUrl}
                  onChange={(e) => setExternalSiteUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] text-sm text-[var(--studio-text)]"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[var(--studio-text)]">iCal-adresse (valgfritt)</span>
                <input
                  type="url"
                  value={externalCalendarUrl}
                  onChange={(e) => setExternalCalendarUrl(e.target.value)}
                  placeholder="https://…/basic.ics (ikke Google embed)"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] text-sm text-[var(--studio-text)]"
                />
                {importHint && (
                  <span className="block text-[11px] text-[var(--studio-muted)]">
                    Med iCal kan dere hente arrangementer fra kirkens kalender inn i planleggeren (Kalender-fanen).
                  </span>
                )}
                {importHint && (
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={importNewAutomatically}
                      onChange={(e) => setImportNewAutomatically(e.target.checked)}
                      className="mt-0.5 rounded border-[var(--studio-border)]"
                    />
                    <span className="text-[11px] text-[var(--studio-muted)]">
                      Opprett nye hendelser automatisk ved oppdatering (samme valg som «Opprett alle» på Kalender).
                    </span>
                  </label>
                )}
              </label>
            </div>
          )}

          <button type="submit" disabled={working} className={`${studioSecondaryButton} inline-flex items-center gap-2 text-xs`}>
            {working && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Lagre flater
          </button>
        </form>
      )}
    </section>
  );
};
