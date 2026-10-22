import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CmsMediaPicker } from "../../../../components/admin/CmsMediaPicker";
import {
  BlockSettings,
  BlockSpacing,
  blockLookSummary,
  blockPeriodLabel,
  blockPeriodState,
  cleanBlockSettings,
} from "../../../../utils/blockSettings";

interface BlockSettingsFieldsProps {
  value?: BlockSettings;
  onChange: (next: BlockSettings) => void;
  /** The block has its own background fields (the modules), so only the space is chosen here. */
  ownBackground?: boolean;
}

type BackgroundMode = "ingen" | "farge" | "bilde";

const fieldClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--studio-panel-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs focus:outline-hidden focus:border-indigo-500";

const labelClass = "space-y-1 block text-xs font-semibold text-[var(--studio-muted)]";

const SPACING_OPTIONS: { value: BlockSpacing; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "liten", label: "Liten" },
  { value: "ingen", label: "Ingen" },
];

/** A folding part under the block's fields, closed by default. */
function Disclosure({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-row)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--studio-text)] cursor-pointer"
      >
        <span>
          <span>{title}</span>
          {!open && <span className="font-normal text-[var(--studio-muted)]">{summary}</span>}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--studio-muted)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="px-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Look and visibility period of a block, shown under its fields in the editor. */
export const BlockSettingsFields: React.FC<BlockSettingsFieldsProps> = ({ value, onChange, ownBackground = false }) => {
  // Set when the user picks a mode, so «Farge» stays chosen before a colour is picked
  const [pickedMode, setPickedMode] = useState<BackgroundMode | null>(null);
  const [tilError, setTilError] = useState(false);

  const mode: BackgroundMode =
    pickedMode ?? (value?.bakgrunnsbilde ? "bilde" : value?.bakgrunn ? "farge" : "ingen");

  const update = (patch: Partial<BlockSettings>) => onChange(cleanBlockSettings({ ...value, ...patch }));

  const lookSummary = blockLookSummary(value);
  const periodLabel = blockPeriodLabel(value);
  const isOver = blockPeriodState(value) === "after";

  const modeButton = (target: BackgroundMode, text: string) => (
    <button
      type="button"
      aria-pressed={mode === target}
      onClick={() => {
        setPickedMode(target);
        // Nothing to clear when no background is set, so the page is not marked as changed
        if (target === "ingen" && (value?.bakgrunn || value?.bakgrunnsbilde)) {
          update({ bakgrunn: undefined, bakgrunnsbilde: undefined });
        }
      }}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
        mode === target
          ? "bg-indigo-600 text-white border-indigo-500"
          : "bg-[var(--studio-surface)] text-[var(--studio-muted)] border-[var(--studio-border)] hover:text-[var(--studio-text)]"
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-2">
      <Disclosure title="Utseende" summary={lookSummary ? `: ${lookSummary}` : ": standard"}>
        <div className="space-y-2">
          {ownBackground ? (
            <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
              Bakgrunn og tekstfarge for denne modulen velges i feltene over.
            </p>
          ) : (
          <>
          <span className="block text-xs font-semibold text-[var(--studio-muted)]">Bakgrunn</span>
          <div className="flex flex-wrap gap-1.5">
            {modeButton("ingen", "Ingen")}
            {modeButton("farge", "Farge")}
            {modeButton("bilde", "Bilde")}
          </div>
          {mode === "farge" && (
            <label className={labelClass}>
              <span className="block">Bakgrunnsfarge</span>
              <input
                type="color"
                aria-label="Bakgrunnsfarge"
                value={value?.bakgrunn ?? "#ffffff"}
                onChange={(e) => update({ bakgrunn: e.target.value, bakgrunnsbilde: undefined })}
                className="h-8 w-16 rounded cursor-pointer bg-transparent"
              />
            </label>
          )}
          {mode === "bilde" && (
            <CmsMediaPicker
              label="Bakgrunnsbilde"
              value={value?.bakgrunnsbilde ?? ""}
              onChange={(url) => update({ bakgrunn: undefined, bakgrunnsbilde: url })}
              decorative
            />
          )}

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--studio-text)]">
            <input
              type="checkbox"
              checked={value?.hvitTekst === true}
              onChange={(e) => update({ hvitTekst: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 bg-[var(--studio-panel-bg)] border-[var(--studio-border)] cursor-pointer"
            />
            <span>Hvit tekst</span>
          </label>
          </>
          )}

          <label className={labelClass}>
            <span className="block">Luft over og under</span>
            <select
              value={value?.luft ?? "normal"}
              onChange={(e) => update({ luft: e.target.value as BlockSpacing })}
              className={fieldClass}
            >
              {SPACING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Disclosure>

      <Disclosure title="Når den vises" summary={`: ${periodLabel ?? "alltid"}`}>
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className={labelClass}>
              <span className="block">Vis fra</span>
              <input
                type="date"
                aria-label="Vis fra"
                value={value?.visFra ?? ""}
                onChange={(e) => {
                  setTilError(false);
                  update({ visFra: e.target.value || undefined });
                }}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              <span className="block">Vis til</span>
              <input
                type="date"
                aria-label="Vis til"
                value={value?.visTil ?? ""}
                onChange={(e) => {
                  const visTil = e.target.value;
                  // A end before the start is not saved; the message says why.
                  if (visTil && value?.visFra && visTil < value.visFra) {
                    setTilError(true);
                    return;
                  }
                  setTilError(false);
                  update({ visTil: visTil || undefined });
                }}
                className={fieldClass}
              />
            </label>
          </div>
          {tilError && <p className="text-[11px] text-rose-400">Til-datoen er før fra-datoen.</p>}
          <p className="text-[11px] text-[var(--studio-muted)]">
            Blokken vises og forsvinner av seg selv. Tomt felt betyr ingen grense.
          </p>
          {isOver && (
            <p className="text-[11px] font-semibold text-amber-400">
              Perioden er over. Blokken vises ikke på nettsiden nå.
            </p>
          )}
        </div>
      </Disclosure>
    </div>
  );
};
