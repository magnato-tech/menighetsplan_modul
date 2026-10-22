import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, CircleHelp, Search, X } from "lucide-react";
import { useCms } from "../../../context/CmsContext";
import { HelpArticleView } from "../help/HelpArticleView";
import {
  findHelpArticle,
  firstHelpArticleIdFor,
  helpSections,
  searchHelp,
  type HelpArticle,
  type HelpNavItem,
  type HelpSection,
} from "../help/articles";
import { studioTabUrl } from "../studio";
import type { StudioArea } from "../studioAreas";
import { webEditorMayOpen } from "../webEditor";

function articleIdFromHash(hash: string, area: StudioArea): string {
  const id = hash.replace(/^#/, "");
  return id || firstHelpArticleIdFor(area);
}

function itemContains(item: HelpNavItem, id: string): boolean {
  if (item.kind === "article") return item.article.id === id;
  return item.articles.some((article) => article.id === id);
}

const navButton = (selected: boolean) =>
  `w-full text-left px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
    selected ? "bg-indigo-600 text-white shadow-sm" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)]"
  }`;

export const HelpTab: React.FC<{ area: StudioArea; webEditor?: boolean }> = ({ area, webEditor = false }) => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { addons } = useCms();
  const activeId = articleIdFromHash(hash, area);
  const article = useMemo(() => findHelpArticle(activeId), [activeId]);
  // The pages menu stands open in the website part, and closed in the planning part, until it is needed
  const [pagesOpen, setPagesOpen] = useState(area === "nettside");
  const [query, setQuery] = useState("");

  // An article about an add-on module is in the help only while the module is on, as its tab is
  // A web editor gets the help for the website part, which is all of the admin they have
  const shown = (candidate: HelpArticle) =>
    (!candidate.addon || addons?.[candidate.addon] === true) && (!webEditor || !candidate.tabs || candidate.tabs.every((tab) => webEditorMayOpen(tab)));
  const sectionShown = (section: HelpSection) => !webEditor || (section.title !== "Planlegging" && section.title !== "Innsikt og moduler");
  // The part of the admin one is in comes first, after Kom i gang
  const rank = (title: string) => (title === "Kom i gang" ? 0 : title === "Planlegging" ? 1 : 2);
  const ordered = area === "planlegging" ? [...helpSections].sort((a, b) => rank(a.title) - rank(b.title)) : helpSections;
  const sections: HelpSection[] = useMemo(
    () =>
      ordered.filter(sectionShown).map((section) => ({
        ...section,
        items: section.items
          .map((item) => (item.kind === "menu" ? { ...item, articles: item.articles.filter(shown) } : item))
          .filter((item) => (item.kind === "article" ? shown(item.article) : item.articles.length > 0)),
      })),
    [addons, area, webEditor]
  );
  const hits = useMemo(() => searchHelp(query, sections.flatMap((section) => section.items.flatMap((item) => (item.kind === "article" ? [item.article] : item.articles)))), [query, sections]);

  useEffect(() => {
    const pagesMenu = helpSections.flatMap((section) => section.items).find((item) => item.kind === "menu" && itemContains(item, article.id));
    if (pagesMenu) setPagesOpen(true);
  }, [article.id]);

  const openArticle = (id: string) => {
    navigate(`${studioTabUrl("cms-hjelp")}#${id}`);
    window.scrollTo?.({ top: 0 });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-[var(--studio-border)] pb-4">
        <div className="p-2.5 rounded-xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)]">
          <CircleHelp className="w-5 h-5 text-[var(--studio-icon)]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--studio-text)] tracking-tight">Hjelp</h1>
          <p className="text-xs text-[var(--studio-muted)]">En artikkel for hver oppgave, i samme rekkefølge som menyen. Søk, eller velg til venstre.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-6 items-start">
        <nav aria-label="Brukerveiledning" className="space-y-5 lg:sticky lg:top-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--studio-muted)]" aria-hidden="true" />
            <input
              type="text"
              role="searchbox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk i hjelpen"
              aria-label="Søk i hjelpen"
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Tøm søket" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {query.trim() ? (
            <div className="space-y-1" aria-live="polite">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">
                {hits.length === 0 ? "Ingen treff" : hits.length === 1 ? "1 treff" : `${hits.length} treff`}
              </div>
              {hits.map((hit) => (
                <button key={hit.id} type="button" onClick={() => openArticle(hit.id)} className={navButton(article.id === hit.id)}>
                  <span className="block">{hit.title}</span>
                  <span className={`block text-[10px] font-semibold ${article.id === hit.id ? "text-white/80" : "text-[var(--studio-muted)]"}`}>{hit.hvor}</span>
                </button>
              ))}
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">{section.title}</div>
                {section.items.map((item) => {
                  if (item.kind === "article") {
                    const selected = article.id === item.article.id;
                    return (
                      <button key={item.article.id} type="button" onClick={() => openArticle(item.article.id)} className={navButton(selected)} aria-current={selected ? "page" : undefined}>
                        {item.article.title}
                      </button>
                    );
                  }
                  return (
                    <div key={item.title} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setPagesOpen((value) => !value)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
                        aria-expanded={pagesOpen}
                      >
                        <span>{item.title}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${pagesOpen ? "rotate-180" : ""}`} />
                      </button>
                      {pagesOpen && (
                        <div className="pl-3 space-y-1">
                          {item.articles.map((child) => {
                            const selected = article.id === child.id;
                            return (
                              <button key={child.id} type="button" onClick={() => openArticle(child.id)} className={navButton(selected)} aria-current={selected ? "page" : undefined}>
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
            ))
          )}
        </nav>

        <div className="rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] p-5 sm:p-6">
          <HelpArticleView article={article} onOpen={openArticle} />
        </div>
      </div>
    </div>
  );
};
