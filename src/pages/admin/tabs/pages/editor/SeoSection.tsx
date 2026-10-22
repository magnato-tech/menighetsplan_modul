import React from "react";
import { Globe, ChevronDown, ChevronUp, Search, Share2, Image as ImageIcon } from "lucide-react";
import { seoLengthHint, seoLengthOf } from "../../../../../utils/seoLength";
import { CmsPage } from "../../../../../data/cmsData";
import { CmsMediaPicker } from "../../../../../components/admin/CmsMediaPicker";

export interface SeoSectionProps {
  editingPage: Partial<CmsPage>;
  onUpdate: (updated: Partial<CmsPage>) => void;
  showSeoDetails: boolean;
  setShowSeoDetails: React.Dispatch<React.SetStateAction<boolean>>;
  siteHost: string;
  cleanSlug: string;
  previewTitle: string;
  previewDescription: string;
  shareImage: string | undefined;
}

export const SeoSection: React.FC<SeoSectionProps> = ({
  editingPage,
  onUpdate,
  showSeoDetails,
  setShowSeoDetails,
  siteHost,
  cleanSlug,
  previewTitle,
  previewDescription,
  shareImage,
}) => {
  return (
    <div data-page-section="seo" className="space-y-4">
      {/* SEO & Deling i sosiale medier */}
      <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)]/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSeoDetails(!showSeoDetails)}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[var(--studio-surface)]/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-[var(--studio-icon)]" />
            <div>
              <span className="text-xs font-bold text-[var(--studio-text)] block">
                Søkemotoroptimalisering (SEO) & Delingskort
              </span>
              <span className="text-[11px] text-[var(--studio-muted)] block">
                Tilpass hvordan siden vises på Google, Facebook og andre sosiale medier.
              </span>
            </div>
          </div>
          {showSeoDetails ? (
            <ChevronUp className="w-4 h-4 text-[var(--studio-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--studio-muted)]" />
          )}
        </button>

        {showSeoDetails && (
          <div className="p-4 pt-2 border-t border-[var(--studio-border)]/70 space-y-4 bg-[var(--studio-panel-bg)]/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--studio-muted)] block">
                  Meta-beskrivelse for søkemotorer
                </label>
                <textarea
                  rows={2}
                  value={editingPage.metaDescription || ""}
                  onChange={(e) => onUpdate({ ...editingPage, metaDescription: e.target.value })}
                  placeholder="Kort beskrivelse (ca. 150-160 tegn) som Google viser under sidetittelen..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500 resize-y"
                />
                <p
                  data-seo-length={seoLengthOf(editingPage.metaDescription || "")}
                  className={`text-[10px] ${
                    seoLengthOf(editingPage.metaDescription || "") === "long" ? "text-amber-600 font-semibold" : "text-[var(--studio-muted)]"
                  }`}
                >
                  {seoLengthHint(editingPage.metaDescription || "")}
                </p>
              </div>

              <div className="space-y-1">
                <CmsMediaPicker
                  label="Delingsbilde (OpenGraph / Facebook / Twitter)"
                  value={editingPage.ogImage || ""}
                  onChange={(ogImage) => onUpdate({ ...editingPage, ogImage })}
                  helpText="La stå tom for å bruke hovedbildet automatisk når det har en delbar adresse."
                  compact
                />
              </div>
            </div>

            {/* Google Search Result Preview */}
            <div className="p-3 rounded-xl bg-white border border-stone-200 text-stone-800 space-y-1 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <Search className="w-3 h-3 text-stone-400" />
                <span className="truncate">{siteHost} › {cleanSlug}</span>
              </div>
              <div className="text-sm font-semibold text-blue-700 hover:underline truncate">
                {previewTitle}
              </div>
              <div className="text-xs text-stone-600 leading-snug line-clamp-2">
                {previewDescription}
              </div>
            </div>

            {/* Social Share Card Preview */}
            <div className="p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--studio-muted)]">
                <Share2 className="w-3 h-3 text-[var(--studio-icon)]" />
                <span>Forhåndsvisning av delebilde på sosiale medier</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                {shareImage ? (
                  <img
                    src={shareImage}
                    alt={editingPage.title || "Forhåndsvisning"}
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-[var(--studio-surface)] flex items-center justify-center text-[var(--studio-muted)] text-xs gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[var(--studio-muted)]" />
                    <span>Intet bilde valgt (standard logo/toppbanner benyttes)</span>
                  </div>
                )}
                <div className="p-3 space-y-1 bg-[var(--studio-input)]">
                  <div className="text-[10px] font-semibold text-[var(--studio-icon)] uppercase tracking-wider">
                    {siteHost}
                  </div>
                  <h4 className="text-xs font-bold text-[var(--studio-text)] truncate">{previewTitle}</h4>
                  <p className="text-[11px] text-[var(--studio-muted)] line-clamp-2 leading-relaxed">{previewDescription}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
