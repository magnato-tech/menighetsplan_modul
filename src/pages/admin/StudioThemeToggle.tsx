import React from "react";
import { Moon, Sun } from "lucide-react";
import type { StudioTheme } from "./studioAppearance";

interface StudioThemeToggleProps {
  theme: StudioTheme;
  onToggle: () => void;
  darkLabel: string;
  lightLabel: string;
  className?: string;
}

export const StudioThemeToggle: React.FC<StudioThemeToggleProps> = ({
  theme,
  onToggle,
  darkLabel,
  lightLabel,
  className = "",
}) => {
  const isDark = theme === "dark";
  const label = isDark ? darkLabel : lightLabel;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-row)] hover:bg-[var(--studio-hover)] text-[var(--studio-text)] text-xs font-semibold transition-colors cursor-pointer ${className}`}
      title={label}
      aria-label={label}
    >
      <span className="flex items-center gap-2">
        {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
        <span>{label}</span>
      </span>
      <span className="text-[10px] text-[var(--studio-muted)]">{isDark ? "Natt" : "Dag"}</span>
    </button>
  );
};

interface StudioThemeIconButtonProps {
  theme: StudioTheme;
  onToggle: () => void;
  /** What is switched, in the label: «innhold» gives «Lyst innhold. Bytt til mørkt innhold». */
  darkLabel: string;
  lightLabel: string;
  className?: string;
}

/** The same switch as a sun or a moon only, for a place where a whole line is too much. */
export const StudioThemeIconButton: React.FC<StudioThemeIconButtonProps> = ({
  theme,
  onToggle,
  darkLabel,
  lightLabel,
  className = "",
}) => {
  const isDark = theme === "dark";
  const label = isDark ? `${darkLabel}. Bytt til ${lightLabel.toLowerCase()}` : `${lightLabel}. Bytt til ${darkLabel.toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer ${className}`}
      title={label}
      aria-label={label}
    >
      {isDark ? <Moon className="w-4 h-4 text-indigo-400" aria-hidden /> : <Sun className="w-4 h-4 text-amber-500" aria-hidden />}
      <span className="sr-only">{label}</span>
    </button>
  );
};
