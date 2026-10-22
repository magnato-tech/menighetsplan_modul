import React from "react";
import { AlertTriangle, ArrowRight, Lightbulb } from "lucide-react";
import { findHelpArticle, type HelpArticle } from "./articles";

interface HelpArticleViewProps {
  article: HelpArticle;
  /** Opens another article, for the links under «Se også». */
  onOpen: (id: string) => void;
}

export function helpArticleImageSrc(articleId: string): string {
  return `/help/hjelp-${articleId}.png`;
}

/** A text with the names of buttons and fields written **like this**, shown in bold. */
export function HelpText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-bold text-[var(--studio-text)]">
            {part}
          </strong>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/** One task: the way there, a picture from the demo, short steps, and what is good to know. */
export const HelpArticleView: React.FC<HelpArticleViewProps> = ({ article, onOpen }) => (
  <article id={article.id} className="scroll-mt-6 space-y-5">
    <header className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">{article.hvor}</p>
      <h2 className="text-xl font-black text-[var(--studio-text)] tracking-tight">{article.title}</h2>
      <p className="text-sm text-[var(--studio-muted)] leading-relaxed">{article.intro}</p>
    </header>

    <div className={article.utenBilde ? "" : "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 items-start"}>
      <ol className="space-y-3">
        {article.steg.map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-px"
            >
              {index + 1}
            </span>
            <span className="text-sm text-[var(--studio-text)] leading-relaxed">
              <HelpText text={step} />
            </span>
          </li>
        ))}
      </ol>

      {!article.utenBilde && (
        <figure className="rounded-xl border border-[var(--studio-border)] overflow-hidden bg-[var(--studio-bg)] shadow-sm xl:sticky xl:top-4">
          {/* A press opens the picture in full size */}
          <a href={helpArticleImageSrc(article.id)} target="_blank" rel="noreferrer" title="Vis bildet i full størrelse" className="block cursor-zoom-in">
            <img src={helpArticleImageSrc(article.id)} alt={`Skjermbilde fra demoen: ${article.title}`} className="w-full h-auto block" loading="lazy" />
          </a>
        </figure>
      )}
    </div>

    {article.godt && (
      <p className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-950 leading-relaxed">
        <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
        <span>
          <strong className="font-bold">Godt å vite: </strong>
          <HelpText text={article.godt} />
        </span>
      </p>
    )}

    {article.passPa && (
      <p className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950 leading-relaxed">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
        <span>
          <strong className="font-bold">Pass på: </strong>
          <HelpText text={article.passPa} />
        </span>
      </p>
    )}

    {article.seOgsa && article.seOgsa.length > 0 && (
      <nav aria-label="Se også" className="pt-1 space-y-2">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)]">Se også</h3>
        <div className="flex flex-wrap gap-2">
          {article.seOgsa.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              className="px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-xs font-semibold text-[var(--studio-accent-text)] hover:bg-[var(--studio-hover)] cursor-pointer flex items-center gap-1.5"
            >
              <span>{findHelpArticle(id).title}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ))}
        </div>
      </nav>
    )}
  </article>
);
