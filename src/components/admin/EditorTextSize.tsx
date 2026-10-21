import { useCallback, useState } from "react";
import type { FC } from "react";

export type EditorTextSize = "normal" | "storre" | "storst";

// CSS zoom factor applied to the fields column of the page editor.
export const EDITOR_TEXT_ZOOM: Record<EditorTextSize, number> = {
  normal: 1,
  storre: 1.15,
  storst: 1.3,
};

const STORAGE_KEY = "menighetsplan:tekststorrelse-redigering";
const VALID_SIZES: readonly EditorTextSize[] = ["normal", "storre", "storst"];

function isEditorTextSize(value: unknown): value is EditorTextSize {
  return typeof value === "string" && (VALID_SIZES as readonly string[]).includes(value);
}

// Storage can be blocked (private mode, settings), so every access is guarded.
function readStoredSize(): EditorTextSize {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isEditorTextSize(value) ? value : "normal";
  } catch {
    return "normal";
  }
}

function writeStoredSize(size: EditorTextSize): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Storage is blocked: the choice lasts until the page is reloaded
  }
}

export function useEditorTextSize(): [EditorTextSize, (size: EditorTextSize) => void] {
  const [size, setSize] = useState<EditorTextSize>(readStoredSize);

  const setAndRemember = useCallback((next: EditorTextSize) => {
    setSize(next);
    writeStoredSize(next);
  }, []);

  return [size, setAndRemember];
}

const SIZE_OPTIONS: { size: EditorTextSize; label: string; title: string; letterClass: string }[] = [
  { size: "normal", label: "A", title: "Normal tekst", letterClass: "text-[11px]" },
  { size: "storre", label: "A", title: "Større tekst", letterClass: "text-[13px]" },
  { size: "storst", label: "A", title: "Størst tekst", letterClass: "text-[15px] font-bold" },
];

export const EditorTextSizeControl: FC<{
  value: EditorTextSize;
  onChange: (size: EditorTextSize) => void;
}> = ({ value, onChange }) => (
  <div
    role="group"
    aria-label="Tekststørrelse i feltene"
    className="flex items-center gap-1 bg-[var(--studio-input)] p-1 rounded-xl border border-[var(--studio-border)]"
  >
    {SIZE_OPTIONS.map((option) => {
      const active = option.size === value;
      return (
        <button
          key={option.size}
          type="button"
          aria-pressed={active}
          aria-label={option.title}
          title={option.title}
          onClick={() => onChange(option.size)}
          className={`px-2 py-1 rounded-lg leading-none transition-all cursor-pointer ${option.letterClass} ${
            active
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)]"
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
