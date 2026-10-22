import React, { useState } from "react";
import { Eye, Monitor, Smartphone, User, X } from "lucide-react";
import type { CmsNewsArticle } from "../../../data/cmsData";
import { CmsContentRenderer } from "../../../components/cms/CmsContentRenderer";
import { useResolvedMediaUrl } from "../../../hooks/useMediaMap";

interface NewsPreviewDialogProps {
  article: Partial<CmsNewsArticle>;
  churchName: string;
  onClose: () => void;
}

const DAY = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * The article as it will stand on its own page, before it is saved, on a computer or a phone, as Ghost
 * shows a post before it is published. Nothing is stored by looking.
 */
export const NewsPreviewDialog: React.FC<NewsPreviewDialogProps> = ({ article, churchName, onClose }) => {
  const [phone, setPhone] = useState(false);
  const image = useResolvedMediaUrl(article.imageUrl);
  const published = article.publishedAt ? new Date(article.publishedAt) : new Date();

  return (
    <div className="fixed inset-0 z-50 bg-[var(--studio-overlay)] backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="news-preview-title">
      <div className="w-full max-w-4xl space-y-3 my-4">
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--studio-bg)] border border-[var(--studio-border)]">
          <h2 id="news-preview-title" className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--studio-icon)]" aria-hidden="true" />
            Forhåndsvisning av artikkelen
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={!phone}
              onClick={() => setPhone(false)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${!phone ? "bg-indigo-600 text-white" : "text-[var(--studio-muted)] hover:bg-[var(--studio-hover)]"}`}
            >
              <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
              PC
            </button>
            <button
              type="button"
              aria-pressed={phone}
              onClick={() => setPhone(true)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${phone ? "bg-indigo-600 text-white" : "text-[var(--studio-muted)] hover:bg-[var(--studio-hover)]"}`}
            >
              <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
              Mobil
            </button>
            <button type="button" onClick={onClose} aria-label="Lukk forhåndsvisningen" className="ml-2 p-1.5 rounded-lg text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`mx-auto bg-stone-50 rounded-2xl shadow-2xl overflow-hidden transition-all ${phone ? "max-w-[390px]" : "max-w-4xl"}`}>
          <div className={`mx-auto space-y-6 ${phone ? "px-4 py-8" : "max-w-3xl px-8 py-12"}`}>
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-800">{article.category}</span>
                <span className="text-xs text-stone-400">·</span>
                <span className="text-xs text-stone-500 capitalize">{DAY.format(published)}</span>
              </div>
              <h1 className={`font-black text-stone-900 tracking-tight leading-tight ${phone ? "text-3xl" : "text-4xl lg:text-5xl"}`}>
                {article.title?.trim() || "Uten tittel"}
              </h1>
              {article.summary && <p className="text-lg text-stone-600 font-medium leading-relaxed">{article.summary}</p>}
              <div className="flex items-center justify-between pt-4 border-t border-stone-100 text-xs text-stone-500">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-stone-400" aria-hidden="true" />
                  <span>
                    Skrevet av <strong className="text-stone-800">{article.author}</strong>
                  </span>
                </span>
                <span className="text-stone-400">{churchName}</span>
              </div>
            </header>
            {image && <img src={image} alt="" className="w-full max-h-[28rem] object-cover rounded-2xl border border-stone-200" />}
            <article className="text-sm sm:text-base">
              <CmsContentRenderer content={article.content || ""} />
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};
