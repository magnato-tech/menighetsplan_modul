import React from "react";
import { Check, Copy } from "lucide-react";
import { CmsPage } from "../../../../../data/cmsData";
import { CmsMediaPicker } from "../../../../../components/admin/CmsMediaPicker";
import { FocusPointPicker } from "../../../../../components/admin/FocusPointPicker";
import { CmsLinkPicker } from "../../../../../components/admin/CmsLinkPicker";
import { useCms } from "../../../../../context/CmsContext";
import { CMS_PREVIEW_TARGET_HERO } from "../../../../../utils/cmsBlocks";
import { HERO_HEIGHTS, HERO_MENU_STYLES, HERO_TITLE_FONTS, HERO_TITLE_SIZES, HERO_TITLE_STYLES, HERO_VEILS, heroExtrasOf, heroHeightOf, heroMenuStyleOf, heroTitleFontOf, heroTitleSizeOf, heroTitleStyleOf, heroVeilOf, type HeroHeight, type HeroMenuStyle, type HeroTitleFont, type HeroTitleSize, type HeroTitleStyle, type HeroVeil } from "../../../../../utils/heroLayout";

export interface HeroSectionProps {
  editingPage: Partial<CmsPage>;
  onUpdate: (updated: Partial<CmsPage>) => void;
  focusedPreviewTarget: string;
  setFocusedPreviewTarget: React.Dispatch<React.SetStateAction<string>>;
  isFrontPage: boolean;
  isHomePage: boolean;
  copiedIngress: true | null;
  showCopiedIngress: (message: true, durationMs?: number) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  editingPage,
  onUpdate,
  focusedPreviewTarget,
  setFocusedPreviewTarget,
  isFrontPage,
  isHomePage,
  copiedIngress,
  showCopiedIngress,
}) => {
  // The site settings hold the welcome headline, which is shown as a placeholder on the front page.
  const { settings } = useCms();
  return (
    <div data-page-section="hero" className="space-y-4">
      {/* 📌 Fast Toppramme (Hero) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFocusedPreviewTarget(CMS_PREVIEW_TARGET_HERO)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setFocusedPreviewTarget(CMS_PREVIEW_TARGET_HERO);
        }}
        data-cms-editor-target={CMS_PREVIEW_TARGET_HERO}
        className={`bg-[var(--studio-input)] border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm cursor-pointer transition-all ${
          focusedPreviewTarget === CMS_PREVIEW_TARGET_HERO
            ? "border-indigo-400 ring-2 ring-indigo-500/60"
            : "border-indigo-700/80"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-950 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <h4 className="text-xs font-bold text-[var(--studio-text)] uppercase tracking-wider flex items-center gap-2">
              <span>📌 Hero / Toppbanner</span>
              <span className="text-[10px] text-[var(--studio-accent-text)] font-normal bg-indigo-950 px-2 py-0.5 rounded border border-[var(--studio-accent-border)]">
                Fast toppramme
              </span>
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-[var(--studio-accent-text)]">
            Låst øverst · Kan ikke flyttes eller slettes
          </span>
        </div>

        {/* The menu over the picture: the first thing a visitor sees, and first here */}
        {isFrontPage && (
          <div className="space-y-1">
          <label className="block space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
            <span className="block">Menyen øverst</span>
            <select
              disabled={!editingPage.heroImage}
              aria-describedby={editingPage.heroImage ? undefined : "hero-menu-hint"}
              value={heroMenuStyleOf(editingPage)}
              onChange={(e) => {
                const heroMenuStyle = e.target.value as HeroMenuStyle;
                onUpdate({ heroMenuStyle, heroMenuOverlay: heroMenuStyle !== "white" });
              }}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {HERO_MENU_STYLES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {!editingPage.heroImage && (
            <p id="hero-menu-hint" className="text-[11px] text-[var(--studio-muted)]">
              Velg et bakgrunnsbilde først. Uten toppbilde står menyen alltid som en hvit linje.
            </p>
          )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">
            Bakgrunnsbilde
          </label>
          <CmsMediaPicker
            label="Hovedbilde"
            value={editingPage.heroImage || ""}
            onChange={(url) => onUpdate({ heroImage: url })}
            decorative
            altValue={editingPage.heroImageAlt || ""}
            onAltChange={(heroImageAlt) => onUpdate({ heroImageAlt })}
            helpText="Dekorativt bakgrunnsbilde. Beskrivelse for skjermleser er valgfritt."
            compact={false}
          />
          {editingPage.heroImage && (
            <div className="pt-2 max-w-sm">
              <FocusPointPicker image={editingPage.heroImage} value={editingPage.heroFocus || ""} onChange={(heroFocus) => onUpdate({ heroFocus })} />
            </div>
          )}
        </div>

        {isFrontPage && (
          <div className="space-y-2.5 p-3 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)]">
            <div>
              <span className="text-xs font-semibold text-[var(--studio-text)] block">Toppbildet: høyde, slør og flere bilder</span>
              <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
                Med flere bilder toner toppen rolig fra det ene til det neste, og prikker under bildet lar den besøkende bla selv. Opptil tre bilder i alt.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
                <span className="block">Høyde på toppbildet</span>
                <select
                  value={heroHeightOf(editingPage)}
                  onChange={(e) => onUpdate({ heroHeight: e.target.value as HeroHeight })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
                >
                  {HERO_HEIGHTS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
                <span className="block">Slør over bildet</span>
                <select
                  value={heroVeilOf(editingPage)}
                  onChange={(e) => onUpdate({ heroVeil: e.target.value as HeroVeil })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
                >
                  {HERO_VEILS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {[0, 1].map((index) => (
              <div key={index} className="space-y-1.5">
                <CmsMediaPicker
                  label={`Toppbilde ${index + 2}`}
                  value={editingPage.heroImages?.[index] || ""}
                  onChange={(url) => {
                    const images = [...(editingPage.heroImages || [])];
                    images[index] = url;
                    // The titles follow their pictures when one is taken out
                    onUpdate(heroExtrasOf(images, editingPage.heroImageTitles));
                  }}
                  decorative
                />
                <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)] block">
                    <span className="block">{`Tittel på toppbilde ${index + 2}`}</span>
                    <input
                      type="text"
                      disabled={!editingPage.heroImages?.[index]}
                      value={editingPage.heroImageTitles?.[index] || ""}
                      onChange={(e) => {
                        const titles = editingPage.heroImages!.map((_, i) => editingPage.heroImageTitles?.[i] || "");
                        titles[index] = e.target.value;
                        onUpdate({ heroImageTitles: titles });
                      }}
                      placeholder={
                        editingPage.heroImages?.[index]
                          ? `Tomt gir hovedtittelen: ${editingPage.heroTitle?.trim() || "tittelen i toppen"}`
                          : "Velg et bilde først"
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs font-normal focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </label>
              </div>
            ))}
            {(editingPage.heroImages?.length ?? 0) > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
                <input
                  type="checkbox"
                  checked={editingPage.heroArrows === true}
                  onChange={(e) => onUpdate({ heroArrows: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
                />
                <span>Piler på sidene av bildet</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
              <input
                type="checkbox"
                checked={editingPage.heroZoom !== false}
                onChange={(e) => onUpdate({ heroZoom: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
              />
              <span>Rolig zoom på toppbildet</span>
            </label>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--studio-muted)] block">Tittel i Hero</label>
          <input
            type="text"
            value={editingPage.heroTitle || ""}
            onChange={(e) => onUpdate({ ...editingPage, heroTitle: e.target.value })}
            placeholder={isHomePage ? settings.welcomeHeadline || "Velkommen til menigheten" : editingPage.title || "Overskrift i toppbanneret"}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
          />
          <p className="text-[11px] text-[var(--studio-muted)]">
            Sidetittelen over styrer menyen. Dette feltet er overskriften i toppbanneret.
          </p>
          {isFrontPage && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
                <span className="block">Tekststørrelse på tittelen</span>
                <select
                  value={heroTitleSizeOf(editingPage)}
                  onChange={(e) => onUpdate({ heroTitleSize: e.target.value as HeroTitleSize })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
                >
                  {HERO_TITLE_SIZES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
                <span className="block">Skrift på tittelen</span>
                <select
                  value={heroTitleFontOf(editingPage)}
                  onChange={(e) => onUpdate({ heroTitleFont: e.target.value as HeroTitleFont })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
                >
                  {HERO_TITLE_FONTS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
                <span className="block">Tittelen på bildet</span>
                <select
                  value={heroTitleStyleOf(editingPage)}
                  onChange={(e) => onUpdate({ heroTitleStyle: e.target.value as HeroTitleStyle })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
                >
                  {HERO_TITLE_STYLES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[var(--studio-muted)] block">
                Ingress / Undertittel
              </label>
              {isHomePage && (
                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--studio-muted)]">
                  <input
                    type="checkbox"
                    checked={editingPage.showHeroSubtext !== false}
                    onChange={(e) => onUpdate({ showHeroSubtext: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
                  />
                  <span>Vis på siden</span>
                </label>
              )}
            </div>
            {editingPage.summary && (
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...editingPage,
                    metaDescription: editingPage.summary,
                  });
                  showCopiedIngress(true);
                }}
                className="text-[10px] text-[var(--studio-icon)] hover:text-[var(--studio-accent-text)] flex items-center gap-1 cursor-pointer transition-colors"
                title="Kopier denne ingressen til meta-beskrivelsen for søkemotorer og sosiale medier"
              >
                {copiedIngress ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Kopiert til SEO-felt</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Bruk som SEO-beskrivelse</span>
                  </>
                )}
              </button>
            )}
          </div>
          <textarea
            rows={2}
            value={editingPage.summary || ""}
            onChange={(e) => onUpdate({ ...editingPage, summary: e.target.value })}
            placeholder="En engasjerende setning eller to som oppsummerer sidens budskap..."
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[var(--studio-muted)] block">Primærknapp</label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--studio-muted)] shrink-0">
                <input
                  type="checkbox"
                  checked={editingPage.showHeroPrimaryCta !== false}
                  onChange={(e) => onUpdate({ showHeroPrimaryCta: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
                />
                <span>Vis på siden</span>
              </label>
            </div>
            <input
              type="text"
              value={editingPage.heroCtaText || ""}
              onChange={(e) => onUpdate({ ...editingPage, heroCtaText: e.target.value })}
              placeholder={isHomePage ? "Se hva som skjer" : "Knappetekst"}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
            />
            <CmsLinkPicker
              value={editingPage.heroCtaLink || ""}
              onChange={(heroCtaLink) => onUpdate({ ...editingPage, heroCtaLink })}
              currentPageId={editingPage.id}
              allowEmpty={isHomePage}
              emptyLabel={isHomePage ? "Hva skjer på forsiden (anbefalt)" : "Ingen lenke"}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[var(--studio-muted)] block">Sekundærknapp</label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--studio-muted)] shrink-0">
                <input
                  type="checkbox"
                  checked={editingPage.showHeroSecondaryCta !== false}
                  onChange={(e) => onUpdate({ showHeroSecondaryCta: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
                />
                <span>Vis på siden</span>
              </label>
            </div>
            <input
              type="text"
              value={editingPage.heroCtaSecondaryText || ""}
              onChange={(e) => onUpdate({ ...editingPage, heroCtaSecondaryText: e.target.value })}
              placeholder={isHomePage ? "Bli kjent med oss" : "Knappetekst"}
              className="w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
            />
            <CmsLinkPicker
              value={editingPage.heroCtaSecondaryLink || ""}
              onChange={(heroCtaSecondaryLink) =>
                onUpdate({ ...editingPage, heroCtaSecondaryLink })
              }
              currentPageId={editingPage.id}
              allowEmpty
              emptyLabel="Ingen lenke"
            />
          </div>
        </div>
      </div>

    </div>
  );
};
