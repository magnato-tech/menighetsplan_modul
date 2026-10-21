import React, { useState } from "react";
import { Eye, EyeOff, GripVertical, Globe, Image, Plus, Search, Settings } from "lucide-react";

export type PageSectionKind = "settings" | "hero" | "block" | "seo" | "publish";

export interface PageSection {
  /** For a block, the block's id; otherwise the kind itself ("settings", "hero", "seo", "publish"). */
  id: string;
  kind: PageSectionKind;
  /** The name shown, e.g. "Toppbilde" or the block's title. */
  label: string;
  /** A short second line, e.g. the block's type ("Tekst", "Modul: Hva skjer"). Optional. */
  detail?: string;
  /** Blocks only: hidden on the website. */
  hidden?: boolean;
  /** Holds changes not saved. */
  unsaved?: boolean;
}

export interface PageSectionNavProps {
  sections: PageSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Called with the ids of ALL blocks in their new order, after a block was moved. */
  onReorderBlocks: (orderedBlockIds: string[]) => void;
  onToggleHidden: (blockId: string) => void;
  /** Folds the list away; the parent then shows a "Seksjoner" button instead. */
  onCollapse: () => void;
  /** Opens the choice of a new block or module, which is put at the end of the page's blocks. */
  onAddBlock?: () => void;
}

/**
 * Pure helper: the block ids with `movedId` placed where `targetId` stands in the original list.
 * The target's index is taken before the move, so dragging down lands the moved id after the target,
 * and dragging up lands it before the target.
 */
export function moveBlockId(ids: string[], movedId: string, targetId: string): string[] {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = ids.filter((id) => id !== movedId);
  next.splice(to, 0, movedId);
  return next;
}

/** The fixed icon for a non-block row, placed where a block shows its grip. */
const KIND_ICONS: Partial<Record<PageSectionKind, React.FC<{ className?: string }>>> = {
  settings: Settings,
  hero: Image,
  seo: Search,
  publish: Globe,
};

export const PageSectionNav: React.FC<PageSectionNavProps> = ({
  sections,
  activeId,
  onSelect,
  onReorderBlocks,
  onToggleHidden,
  onCollapse,
  onAddBlock,
}) => {
  // Kept in state so the row can show where the drop lands; cleared on drop and drag end.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const blockIds = sections.filter((s) => s.kind === "block").map((s) => s.id);

  const clearDrag = () => {
    setDraggedId(null);
    setDropTargetId(null);
  };

  const onKeyDownBlock = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const from = blockIds.indexOf(id);
    const to = event.key === "ArrowUp" ? from - 1 : from + 1;
    // At either end there is nothing to swap with.
    if (from < 0 || to < 0 || to >= blockIds.length) return;
    const next = [...blockIds];
    [next[from], next[to]] = [next[to], next[from]];
    onReorderBlocks(next);
  };

  return (
    <nav
      aria-label="Seksjoner på siden"
      data-page-section-nav
      className="w-full max-h-full overflow-y-auto rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-2 text-[11px]"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--studio-muted)]">Seksjoner</span>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Skjul seksjoner"
          title="Skjul seksjoner"
          className="px-1.5 py-0.5 rounded text-xs font-bold text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text)] cursor-pointer"
        >
          ‹‹
        </button>
      </div>

      <ul className="flex flex-col gap-0.5">
        {sections.map((section) => {
          const active = section.id === activeId;
          const isBlock = section.kind === "block";
          const isDropTarget = isBlock && dropTargetId === section.id && draggedId !== section.id;
          const Icon = isBlock ? null : KIND_ICONS[section.kind];

          return (
            <li
              key={section.id}
              data-section-id={section.id}
              draggable={isBlock || undefined}
              onDragStart={
                isBlock
                  ? (event) => {
                      setDraggedId(section.id);
                      event.dataTransfer?.setData("text/plain", section.id);
                      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                    }
                  : undefined
              }
              onDragOver={
                isBlock && draggedId
                  ? (event) => {
                      event.preventDefault();
                      setDropTargetId(section.id);
                    }
                  : undefined
              }
              onDrop={
                isBlock && draggedId
                  ? (event) => {
                      event.preventDefault();
                      if (draggedId !== section.id) onReorderBlocks(moveBlockId(blockIds, draggedId, section.id));
                      clearDrag();
                    }
                  : undefined
              }
              onDragEnd={isBlock ? clearDrag : undefined}
              className={`relative flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                active ? "bg-indigo-600 text-white" : "text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text)]"
              }`}
            >
              {isDropTarget && (
                <span aria-hidden="true" className="absolute left-1 right-1 top-0 h-0.5 rounded bg-indigo-600" />
              )}

              {isBlock ? (
                <span aria-hidden="true" className="pl-1 cursor-grab opacity-60 shrink-0">
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span aria-hidden="true" className="pl-1 shrink-0">
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                </span>
              )}

              <button
                type="button"
                onClick={() => onSelect(section.id)}
                onKeyDown={isBlock ? (event) => onKeyDownBlock(event, section.id) : undefined}
                aria-current={active ? "true" : undefined}
                className="flex-1 min-w-0 text-left py-1.5 px-1 cursor-pointer"
              >
                <span
                  className={`block truncate font-semibold ${
                    section.hidden ? "line-through opacity-60" : ""
                  }`}
                >
                  {section.label}
                </span>
                {section.detail && <span className="block truncate text-[10px] opacity-70">{section.detail}</span>}
              </button>

              {section.unsaved && (
                <span
                  role="img"
                  aria-label="Ikke lagret"
                  title="Ikke lagret"
                  className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                />
              )}

              {isBlock && (
                <button
                  type="button"
                  onClick={() => onToggleHidden(section.id)}
                  aria-label={section.hidden ? "Vis på nettsiden" : "Skjul på nettsiden"}
                  title={section.hidden ? "Vis på nettsiden" : "Skjul på nettsiden"}
                  className={`p-1 rounded shrink-0 cursor-pointer ${
                    active ? "text-white/80 hover:text-white" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                  }`}
                >
                  {section.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {onAddBlock && (
        <button
          type="button"
          onClick={onAddBlock}
          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-[var(--studio-border)] text-[11px] font-semibold text-[var(--studio-accent-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Legg til blokk eller modul
        </button>
      )}
    </nav>
  );
};
