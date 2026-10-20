import React from "react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { MENU_BAR_STATE_LABELS, type MenuBarItem, type MenuBarState } from "../../../../utils/menu";

interface PageMenuBarProps {
  items: MenuBarItem[];
  /** The main tab the list is scrolled to. */
  activeId: string | null;
  /** Scrolls the list to a page; a sub-page names the main tab it stands under. */
  onJump: (pageId: string, parentId?: string) => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  /** «Kollaps alle» and «Utvid alle» only mean something when a tab has sub-pages, and only over the list. */
  canFold?: boolean;
  /** Stays at the top while the list scrolls. Over the editor it stands still, and lies above the editor's own
   *  line (z-30), so the drop-downs are not hidden behind it. */
  sticky?: boolean;
}

const StateTag: React.FC<{ state: MenuBarState }> = ({ state }) =>
  state === "published" ? null : (
    <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--studio-hover)] text-[9px] font-bold uppercase tracking-wide text-[var(--studio-muted)]">
      {MENU_BAR_STATE_LABELS[state]}
    </span>
  );

/** Escape closes an open drop-down: the menu opens on hover and on keyboard focus. */
const closeOnEscape = (event: React.KeyboardEvent) => {
  if (event.key === "Escape" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

/**
 * The website's menu at the top of the page list, on a large screen: a click on a main tab, or on a
 * sub-page under it, scrolls the list there. It stays at the top while the list scrolls.
 */
export const PageMenuBar: React.FC<PageMenuBarProps> = ({ items, activeId, onJump, onCollapseAll, onExpandAll, canFold = false, sticky = true }) => (
  <nav
    aria-label="Menyen på nettsiden"
    className={`flex ${sticky ? "sticky top-[var(--demo-strip,0px)] z-20" : "relative z-40"} items-center justify-between gap-3 px-3 py-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-sm`}
    onKeyDown={closeOnEscape}
  >
    <ul className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = item.id === activeId;
        const dimmed = item.state !== "published";
        return (
          <li key={item.id} className="relative group">
            <button
              type="button"
              onClick={() => onJump(item.id)}
              aria-current={active ? "location" : undefined}
              aria-haspopup={item.children.length > 0 ? "true" : undefined}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? "bg-indigo-600 text-white"
                  : `${dimmed ? "text-[var(--studio-muted)]" : "text-[var(--studio-text)]"} hover:bg-[var(--studio-hover)]`
              }`}
            >
              <span>{item.title}</span>
              {!active && <StateTag state={item.state} />}
              {item.children.length > 0 && <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden />}
            </button>
            {item.children.length > 0 && (
              <div className="absolute left-0 top-full pt-1 z-30 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                <ul className="min-w-[200px] py-1.5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-xl">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={(event) => {
                          onJump(child.id, item.id);
                          event.currentTarget.blur();
                        }}
                        className={`w-full text-left px-3.5 py-1.5 text-xs font-medium hover:bg-[var(--studio-hover)] cursor-pointer ${
                          child.state === "published" ? "text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
                        }`}
                      >
                        <span>{child.title}</span>
                        <StateTag state={child.state} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
    {canFold && (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onCollapseAll}
          title="Kollaps alle underfaner"
          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] flex items-center gap-1 cursor-pointer"
        >
          <ChevronsDownUp className="w-3.5 h-3.5" aria-hidden />
          <span>Kollaps alle</span>
        </button>
        <button
          type="button"
          onClick={onExpandAll}
          title="Utvid alle underfaner"
          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] flex items-center gap-1 cursor-pointer"
        >
          <ChevronsUpDown className="w-3.5 h-3.5" aria-hidden />
          <span>Utvid alle</span>
        </button>
      </div>
    )}
  </nav>
);
