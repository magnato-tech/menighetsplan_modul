import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { CmsResolvedLink } from "../CmsResolvedLink";
import { useCms } from "../../../context/CmsContext";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { shownNews } from "../../../utils/news";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";
import { PresentationSection } from "../PresentationSection";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";
import { useRevealChildren } from "../../../hooks/useRevealChildren";
import { ChevronRight, ArrowRight } from "lucide-react";

export interface NewsModuleProps {
  variant?: "grid" | "compact";
  limit?: number;
  presentation?: ModulePresentationConfig;
}

export const NewsModule: React.FC<NewsModuleProps> = ({
  variant = "grid",
  limit = 3,
  presentation,
}) => {
  const { news } = useCms();
  const { gatherings, gatheringsReady } = useFirebase();
  const mediaById = useMediaMap();
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-news"];
  const defaults = MODULE_PRESENTATION_DEFAULTS["module-news"];

  // What is shown is settled once, when the module is drawn: published, and not past its last day
  const now = useMemo(() => Date.now(), []);
  const publishedNews = useMemo(
    () => shownNews(news ?? [], gatheringsReady ? gatherings : null, now).slice(0, limit),
    [news, gatherings, gatheringsReady, now, limit]
  );
  // The reveal follows the cards as they arrive
  const cards = useRevealChildren<HTMLDivElement>(publishedNews.length);

  const badge = presentationText(config, "badge", defaults.badge);
  const title = presentationText(config, "title", defaults.title);
  const linkLabel = presentationText(config, "linkLabel", defaults.linkLabel);
  const linkUrl = presentationText(config, "linkUrl", defaults.linkUrl);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("no-NO", {
        day: "numeric",
        month: "long",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const hasCustomBg = Boolean(config.backgroundImage?.trim() || config.backgroundColor?.trim());

  return (
    <PresentationSection
      config={config}
      className={`w-full py-14 px-4 sm:px-6 lg:px-8 border-y my-10 ${
        hasCustomBg ? "" : "bg-stone-100/70 border-stone-200/60"
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary-700">{badge}</h2>
            <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-1">
              {title}
            </h3>
          </div>
          <CmsResolvedLink
            raw={linkUrl}
            fallback={defaults.linkUrl}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:text-primary-900 group"
          >
            <span>{linkLabel}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </CmsResolvedLink>
        </div>

        {publishedNews.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
            Ingen nyhetsartikler publisert for øyeblikket.
          </div>
        ) : variant === "compact" ? (
          <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 shadow-xs overflow-hidden">
            {publishedNews.map((article) => (
              <div
                key={article.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/80 transition-colors"
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary-700 mb-1">
                    {article.category || "Aktuelt"} · {formatDate(article.publishedAt || "")}
                  </div>
                  <h4 className="font-bold text-stone-900 text-base">{article.title}</h4>
                  {article.summary && (
                    <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">{article.summary}</p>
                  )}
                </div>
                <Link
                  to={`/artikkel/${article.id}`}
                  className="text-xs font-bold text-primary-700 hover:text-primary-900 flex items-center gap-1 shrink-0"
                >
                  <span>Les saken</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div ref={cards} className="reveal-children grid grid-cols-1 md:grid-cols-3 gap-5">
            {publishedNews.map((article) => {
              const image = resolveMediaUrl(article.imageUrl, mediaById, "web");
              return (
              <Link
                key={article.id}
                to={`/artikkel/${article.id}`}
                className="bg-white rounded-2xl border border-stone-200/80 p-5 hover:border-primary-300 hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden"
              >
                <div className="space-y-2">
                  {image && (
                    // The title right below says what the article is; the picture is not described twice
                    <div className="-mx-5 -mt-5 mb-4 h-40 bg-stone-200">
                      <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary-700">
                    {article.category || "Aktuelt"}
                  </div>
                  <h4 className="font-bold text-stone-900 text-lg leading-snug group-hover:text-primary-800 transition-colors">
                    {article.title}
                  </h4>
                  {article.summary && (
                    <p className="text-xs text-stone-500 line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                </div>
                <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span>{formatDate(article.publishedAt || "")}</span>
                  <span className="font-bold text-primary-700 group-hover:text-primary-900">
                    Les saken →
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </PresentationSection>
  );
};
