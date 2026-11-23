import React from "react";
import { Check, Copy } from "lucide-react";
import { CmsPage } from "../../../../../data/cmsData";
import { CmsMediaPicker } from "../../../../../components/admin/CmsMediaPicker";
import { CropPicker } from "../../../../../components/admin/CropPicker";
import { CmsLinkPicker } from "../../../../../components/admin/CmsLinkPicker";
import { useCms } from "../../../../../context/CmsContext";
import { CMS_PREVIEW_TARGET_HERO } from "../../../../../utils/cmsBlocks";
import { HERO_HEIGHTS, HERO_MENU_STYLES, HERO_TITLE_FONTS, HERO_TITLE_SIZES, HERO_TITLE_STYLES, HERO_VEILS, heroExtrasOf, heroHeightOf, heroMenuStyleOf, heroTitleFontOf, heroTitleSizeOf, heroTitleStyleOf, heroVeilOf, type HeroMenuStyle, type HeroTitleFont, type HeroTitleSize, type HeroTitleStyle, type HeroVeil } from "../../../../../utils/heroLayout";

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

const INPUT_CLASS = "w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500";
const SELECT_CLASS = "w-full px-3 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs";
const CHECKBOX_CLASS = "w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer";

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
  // The site settings hold the welcome headline and intro. On the front page they are shown as placeholders.
  const { settings } = useCms();

  // One extra picture at a time: tile 2 waits for the main picture, tile 3 waits for tile 2.
  const extraPictureTile = (index: number) => (
    <CmsMediaPicker
      key={index}
      label={`Toppbilde ${index + 2}`}
      value={editingPage.heroImages?.[index] || ""}
      onChange={(url) => {
        const images = [...(editingPage.heroImages || [])];
        images[index] = url;
        // The titles follow their pictures when one is taken out
        onUpdate(heroExtrasOf(images, editingPage.heroImageTitles));
      }}
      decorative
      tile
    />
  );

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
              <span>Toppbilde</span>
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-[var(--studio-accent-text)]">
            Står alltid øverst på siden
          </span>
        </div>

        {/* 1. Bildene: hovedbildet, og på forsiden to til som toner over i hverandre */}
        <div className="space-y-2">
          <div>
            <span className="text-xs font-semibold text-[var(--studio-muted)] block">Bilder</span>
            {isFrontPage && (
              <span className="text-[11px] text-[var(--studio-muted)]">(opptil tre – de toner over i hverandre)</span>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <CmsMediaPicker
              label="Hovedbilde"
              value={editingPage.heroImage || ""}
              onChange={(url) => onUpdate({ heroImage: url })}
              decorative
              altValue={editingPage.heroImageAlt || ""}
              onAltChange={(heroImageAlt) => onUpdate({ heroImageAlt })}
              tile
            />
            {isFrontPage && editingPage.heroImage && extraPictureTile(0)}
            {isFrontPage && editingPage.heroImage && editingPage.heroImages?.[0] && extraPictureTile(1)}
          </div>
        </div>

        {/* 2. Overskriften på bildet */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-[var(--studio-muted)] block">Overskrift</span>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--studio-muted)] block">Tittel i Hero</label>
            <input
              type="text"
              value={editingPage.heroTitle || ""}
              onChange={(e) => onUpdate({ ...editingPage, heroTitle: e.target.value })}
              placeholder={isHomePage ? settings.welcomeHeadline || "Velkommen til menigheten" : editingPage.title || "Overskrift i toppbanneret"}
              className={INPUT_CLASS}
            />
            <p className="text-[11px] text-[var(--studio-muted)]">
              Sidetittelen over styrer menyen. Dette feltet er overskriften i toppbanneret.
            </p>
          </div>
        </div>

        {/* 3. Høyden på forsiden, med tre knapper */}
        {isFrontPage && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--studio-muted)] block">Høyde på datamaskin</span>
            <div role="radiogroup" aria-label="Høyde på datamaskin" className="flex flex-wrap gap-1.5">
              {HERO_HEIGHTS.map((option) => {
                const checked = heroHeightOf(editingPage) === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    title={option.label}
                    onClick={() => onUpdate({ heroHeight: option.value })}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-[var(--studio-panel-bg)] border-[var(--studio-border)] text-[var(--studio-input-text)] hover:border-indigo-500"
                    }`}
                  >
                    {option.label.split(" – ")[0]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--studio-muted)]">På mobil vises bare overskriften i en tynn linje.</p>
          </div>
        )}

        {/* 4. Alt det andre, samlet og lukket som standard */}
        <details className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-row)] p-3">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
            <span>Flere valg</span>{" "}
            <span className="text-[11px] font-normal text-[var(--studio-muted)]">
              menyen over bildet, slør, rolig zoom, skrift og størrelse på overskriften, ingress, knapper, beskrivelse for skjermleser
            </span>
          </summary>

          <div className="mt-3 space-y-3">
            {/* The menu over the picture: the first thing a visitor sees */}
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
                    className={`${SELECT_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
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

            {/* Beskrivelse for skjermleser for hovedbildet, og utsnittet */}
            <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)] block">
              <span className="block">Beskrivelse for skjermleser (valgfritt for dekor)</span>
              <input
                type="text"
                value={editingPage.heroImageAlt || ""}
                onChange={(e) => onUpdate({ heroImageAlt: e.target.value })}
                placeholder="La stå tom for dekorativt bilde"
                className={INPUT_CLASS}
              />
              <span className="block text-[11px] font-normal text-[var(--studio-muted)]">
                Dekorativt bakgrunnsbilde. Beskrivelse for skjermleser er valgfritt.
              </span>
            </label>
            {editingPage.heroImage && (
              <div className="max-w-sm">
                <CropPicker image={editingPage.heroImage} value={editingPage.heroFocus || ""} onChange={(heroFocus) => onUpdate({ heroFocus })} aspect={16 / 9} />
              </div>
            )}

            {isFrontPage && (
              <div className="space-y-2.5">
                <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)] block">
                  <span className="block">Slør over bildet</span>
                  <select
                    value={heroVeilOf(editingPage)}
                    onChange={(e) => onUpdate({ heroVeil: e.target.value as HeroVeil })}
                    className={SELECT_CLASS}
                  >
                    {HERO_VEILS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {[0, 1].map((index) => (
                  <label key={index} className="space-y-1 text-xs font-semibold text-[var(--studio-muted)] block">
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
                ))}
                {(editingPage.heroImages?.length ?? 0) > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
                    <input
                      type="checkbox"
                      checked={editingPage.heroArrows === true}
                      onChange={(e) => onUpdate({ heroArrows: e.target.checked })}
                      className={CHECKBOX_CLASS}
                    />
                    <span>Piler på sidene av bildet</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
                  <input
                    type="checkbox"
                    checked={editingPage.heroZoom !== false}
                    onChange={(e) => onUpdate({ heroZoom: e.target.checked })}
                    className={CHECKBOX_CLASS}
                  />
                  <span>Rolig zoom på toppbildet</span>
                </label>
              </div>
            )}

            {isFrontPage && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-semibold text-[var(--studio-muted)]">
                  <span className="block">Tekststørrelse på tittelen</span>
                  <select
                    value={heroTitleSizeOf(editingPage)}
                    onChange={(e) => onUpdate({ heroTitleSize: e.target.value as HeroTitleSize })}
                    className={SELECT_CLASS}
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
                    className={SELECT_CLASS}
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
                    className={SELECT_CLASS}
                  >
                    {HERO_TITLE_STYLES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

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
                        className={CHECKBOX_CLASS}
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
                placeholder={(isHomePage && settings.welcomeSubtext) || "En engasjerende setning eller to som oppsummerer sidens budskap..."}
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
                      className={CHECKBOX_CLASS}
                    />
                    <span>Vis på siden</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={editingPage.heroCtaText || ""}
                  onChange={(e) => onUpdate({ ...editingPage, heroCtaText: e.target.value })}
                  placeholder={isHomePage ? "Se hva som skjer" : "Knappetekst"}
                  className={INPUT_CLASS}
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
                      className={CHECKBOX_CLASS}
                    />
                    <span>Vis på siden</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={editingPage.heroCtaSecondaryText || ""}
                  onChange={(e) => onUpdate({ ...editingPage, heroCtaSecondaryText: e.target.value })}
                  placeholder={isHomePage ? "Bli kjent med oss" : "Knappetekst"}
                  className={INPUT_CLASS}
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
        </details>
      </div>

    </div>
  );
};
