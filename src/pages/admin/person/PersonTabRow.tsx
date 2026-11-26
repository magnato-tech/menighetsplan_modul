import type { KeyboardEvent } from "react";
import { personTabId, type PersonTab, type PersonTabItem } from "./personShared";

interface PersonTabRowProps {
  visibleTabs: readonly PersonTabItem[];
  activeTab: PersonTab;
  panelId: string;
  selectTab: (tab: PersonTab) => void;
  handleTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
}

// The tab buttons of the card; the keyboard handling is in the page
export function PersonTabRow({ visibleTabs, activeTab, panelId, selectTab, handleTabKeyDown }: PersonTabRowProps) {
  return (
    <div
      role="tablist"
      aria-label="Deler av personkortet"
      className="flex gap-1 p-1 rounded-xl bg-[var(--studio-row)] overflow-x-auto"
    >
      {visibleTabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={personTabId(tab.id)}
            aria-selected={selected}
            aria-controls={selected ? panelId : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              selected
                ? "bg-[var(--studio-surface)] text-[var(--studio-text)] shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
