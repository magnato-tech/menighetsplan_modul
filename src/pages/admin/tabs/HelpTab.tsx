import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, CircleHelp } from "lucide-react";
import { HelpArticleView } from "../help/HelpArticleView";
import {
  findHelpArticle,
  firstHelpArticleIdFor,
  helpSections,
  type HelpNavItem,
} from "../help/articles";
import { studioTabUrl } from "../studio";
import type { StudioArea } from "../studioAreas";

function articleIdFromHash(hash: string, area: StudioArea): string {
  const id = hash.replace(/^#/, "");
  return id || firstHelpArticleIdFor(area);
}

function itemContains(item: HelpNavItem, id: string): boolean {
  if (item.kind === "article") return item.article.id === id;
  return item.articles.some((article) => article.id === id);
}

export const HelpTab: React.FC<{ area: StudioArea }> = ({ area }) => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const activeId = articleIdFromHash(hash, area);
  const article = useMemo(() => findHelpArticle(activeId), [activeId]);
  const [pagesOpen, setPagesOpen] = useState(true);

  useEffect(() => {
    const pagesMenu = helpSections
      .flatMap((section) => section.items)
      .find((item) => item.kind === "menu" && itemContains(item, article.id));
    if (pagesMenu) setPagesOpen(true);
  }, [article.id]);

  const openArticle = (id: string) => {
    navigate(`${studioTabUrl("cms-hjelp")}#${id}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-[var(--studio-border)] pb-4">
        <div className="p-2.5 rounded-xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)]">
          <CircleHelp className="w-5 h-5 text-[var(--studio-icon)]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--studio-text)] tracking-tight">Hjelp</h1>
          <p className="text-xs text-[var(--studio-muted)]">
            Velg en arbeidsflyt. Lenken i adresselinjen kan deles direkte.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-6 items-start">
        <nav aria-label="Brukerveiledning" className="space-y-5 lg:sticky lg:top-4">
          {helpSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">
                {section.title}
              </div>
              {section.items.map((item) => {
                if (item.kind === "article") {
                  const selected = article.id === item.article.id;
                  return (
                    <button
                      key={item.article.id}
                      type="button"
                      onClick={() => openArticle(item.article.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                        selected
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"
                      }`}
                      aria-current={selected ? "page" : undefined}
                    >
                      {item.article.title}
                    </button>
                  );
                }

                const open = pagesOpen;
                return (
                  <div key={item.title} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setPagesOpen((value) => !value)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                      aria-expanded={open}
                    >
                      <span>{item.title}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="pl-3 space-y-1">
                        {item.articles.map((child) => {
                          const selected = article.id === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => openArticle(child.id)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                                selected
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"
                              }`}
                              aria-current={selected ? "page" : undefined}
                            >
                              {child.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] p-5 sm:p-6">
          <HelpArticleView article={article} />
        </div>
      </div>
    </div>
  );
};
