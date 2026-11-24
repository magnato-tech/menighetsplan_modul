import React, { useEffect, useRef, useState } from "react";
import { studioSecondaryButton } from "../../studioTheme";

interface ButtonMenuProps {
  /** The text on the button that opens the panel, for example «Mal ▾». */
  label: string;
  /** Names the panel for screen readers. */
  ariaLabel: string;
  /** The content of the panel. Given the way to close it, for items that choose something and close. */
  children: (close: () => void) => React.ReactNode;
}

/** A button that opens a small panel under it. The panel closes on a press outside it, or on Escape. */
export const ButtonMenu: React.FC<ButtonMenuProps> = ({ label, ariaLabel, children }) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const pressed = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", pressed);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", pressed);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-block">
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={studioSecondaryButton}>
        {label}
      </button>
      {open && (
        <div role="group" aria-label={ariaLabel} className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] p-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-lg space-y-3">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};
