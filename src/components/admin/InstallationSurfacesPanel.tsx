import React, { useEffect, useState } from "react";
import { Copy, Globe, LayoutDashboard, Loader2 } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { homepageError, icalImportOn, normalizeExternalCalendarUrl } from "../../utils/surfaces";
import type { ShowFeedback } from "../../pages/admin/studio";
import { studioSecondaryButton } from "../../pages/admin/studioTheme";

interface InstallationSurfacesPanelProps {
  showFeedback: ShowFeedback;
}

/**
 * Which flat surfaces are on: Min side, and the congregation's homepage. The homepage is either the website in
 * this app («Nettsiden her», ownWebsite) or another website at its own address («En annen nettside»,
 * externalSiteUrl). When another website is the homepage, the address is required and the optional iCal import
 * is shown (see utils/surfaces.ts).
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

  const minSideLink = `${window.location.origin}/minside`;

  const copyMinSideLink = async () => {
    try {
      await navigator.clipboard.writeText(minSideLink);
      showFeedback("Lenken er kopiert.");
    } catch {
      showFeedback("Lenken ble ikke kopiert.", "error");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const siteUrl = externalSiteUrl.trim();
    const problem = homepageError({ ownWebsite, externalSiteUrl: siteUrl });
    if (problem) {
      showFeedback(problem, "error");
      return;
    }
    const calendarUrl = normalizeExternalCalendarUrl(externalCalendarUrl);
    setWorking(true);
    const ok = await saveSurfaces({
      minSide,
      ownWebsite,
      externalSiteUrl: siteUrl,
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

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-[var(--studio-text)] mb-2">Menighetens hjemmeside</legend>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="homepage"
                checked={ownWebsite}
                onChange={() => setOwnWebsite(true)}
                className="mt-1 border-[var(--studio-border)]"
              />
              <span>
                <span className="block text-sm font-bold text-[var(--studio-text)]">
                  Nettsiden her <span className="font-black">{window.location.host}</span>
                </span>
                <span className="block text-xs text-[var(--studio-muted)] mt-0.5">
                  Nettsiden lages og redigeres her i admin. Adressen viser nettsiden.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="homepage"
                checked={!ownWebsite}
                onChange={() => setOwnWebsite(false)}
                className="mt-1 border-[var(--studio-border)]"
              />
              <span>
                <span className="block text-sm font-bold text-[var(--studio-text)]">En annen nettside</span>
                <span className="block text-xs text-[var(--studio-muted)] mt-0.5">
                  Adressen her går rett til Min side, med innlogging foran. Lenkene til nettsiden går til adressen under.
                </span>
              </span>
            </label>
          </fieldset>

          {!ownWebsite && (
            <div className="space-y-3 pl-7 border-l-2 border-[var(--studio-border)]">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[var(--studio-text)]">Adressen til hjemmesiden (https)</span>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={externalSiteUrl}
                  onChange={(e) => setExternalSiteUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] text-sm text-[var(--studio-text)]"
                />
                <span className="block text-[11px] text-[var(--studio-muted)]">
                  Lenkene «Til nettsiden» og «Åpne menighetens nettside» går hit.
                </span>
              </label>
              <div className="space-y-2">
                <span className="block text-xs font-bold text-[var(--studio-text)]">Direkte lenke til Min side</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={minSideLink}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] text-sm text-[var(--studio-text)]"
                  />
                  <button type="button" onClick={() => void copyMinSideLink()} className={`${studioSecondaryButton} inline-flex items-center gap-2 text-xs`}>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    Kopier
                  </button>
                </div>
                <p className="text-[11px] text-[var(--studio-muted)]">
                  Har menigheten en annen nettside i tillegg, kan denne lenken legges der, f.eks. som «Min side» eller «Logg inn» i menyen.
                </p>
              </div>
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
