import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface HeroButtonsProps {
  primaryText?: string;
  primaryLink?: string;
  secondaryText?: string;
  secondaryLink?: string;
  showPrimary?: boolean;
  showSecondary?: boolean;
  tone?: "on-dark" | "on-light";
  align?: "center" | "start";
  /** "compact": smaller buttons, for the thin band on a phone. */
  size?: "normal" | "compact";
}

function HeroAnchor({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: React.ReactNode;
}) {
  if (to.startsWith("http://") || to.startsWith("https://")) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to || "/"} className={className}>
      {children}
    </Link>
  );
}

export const HeroButtons: React.FC<HeroButtonsProps> = ({
  primaryText,
  primaryLink,
  secondaryText,
  secondaryLink,
  showPrimary = true,
  showSecondary = true,
  tone = "on-dark",
  align = "center",
  size = "normal",
}) => {
  const primaryVisible = showPrimary && Boolean(primaryText) && Boolean(primaryLink);
  const secondaryVisible = showSecondary && Boolean(secondaryText) && Boolean(secondaryLink);
  if (!primaryVisible && !secondaryVisible) return null;

  const compact = size === "compact";
  const primaryClass = compact
    ? tone === "on-dark"
      ? "px-3.5 py-2 rounded-lg bg-accent-400 hover:bg-accent-300 text-stone-950 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
      : "px-3.5 py-2 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
    : tone === "on-dark"
      ? "px-6 py-3.5 rounded-xl bg-accent-400 hover:bg-accent-300 text-stone-950 font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
      : "px-5 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2";
  const secondaryClass = compact
    ? tone === "on-dark"
      ? "px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-xs backdrop-blur-sm border border-white/20 transition-all"
      : "px-3.5 py-2 rounded-lg bg-white hover:bg-stone-50 text-stone-800 font-semibold text-xs border border-stone-300 transition-all"
    : tone === "on-dark"
      ? "px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm backdrop-blur-sm border border-white/20 transition-all"
      : "px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 font-semibold text-sm border border-stone-300 transition-all";

  return (
    <div className={`pt-2 flex flex-wrap items-center ${compact ? "gap-2" : "gap-3"} ${align === "start" ? "justify-start" : "justify-center"}`}>
      {primaryVisible && (
        <HeroAnchor to={primaryLink || "/"} className={primaryClass}>
          <span>{primaryText}</span>
          <ArrowRight className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </HeroAnchor>
      )}
      {secondaryVisible && (
        <HeroAnchor to={secondaryLink || "/"} className={secondaryClass}>
          {secondaryText}
        </HeroAnchor>
      )}
    </div>
  );
};
