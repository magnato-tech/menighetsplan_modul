import { useEffect, useRef, useState } from "react";

interface FilterMenuProps<T extends string> {
  id: string;
  /** The caption: «Rolle», «Gruppetype». Shown with the chosen ones after it. */
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
}

/** A small menu of checkboxes for a filter that may choose several things. Closes when one clicks outside it. */
export function FilterMenu<T extends string>({ id, label, options, selected, onChange }: FilterMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [open]);

  const chosen = options.filter((option) => selected.includes(option.value)).map((option) => option.label);
  const summary = chosen.length > 0 ? `${label}: ${chosen.join(", ")}` : label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-semibold cursor-pointer"
      >
        {summary} ▾
      </button>
      {open && (
        <div role="group" aria-label={label} className="absolute left-0 z-20 mt-1 min-w-[12rem] p-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-lg space-y-0.5">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))}
              />
              {option.label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="mt-1 w-full px-2 py-1.5 rounded-lg text-left text-xs font-bold text-indigo-600 hover:bg-[var(--studio-hover)] disabled:opacity-40 cursor-pointer"
          >
            Nullstill
          </button>
        </div>
      )}
    </div>
  );
}
