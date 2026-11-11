import React from "react";
import { Calendar, Church, ListTodo, Users } from "lucide-react";
import type { MinSideModuleId } from "../../utils/minSideModules";

// The parts of Min side. The name of the one that is open, is the heading of the page.

export type MyPageTab = "oppgaver" | "grupper" | "kalender" | "gudstjenester";

export interface MyPageTabDef {
  id: MyPageTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The Min side module the tab belongs to. A tab without one is always there. */
  module?: MinSideModuleId;
}

export const MY_PAGE_TABS: MyPageTabDef[] = [
  { id: "oppgaver", label: "Mine oppgaver", icon: ListTodo },
  { id: "grupper", label: "Mine grupper", icon: Users, module: "grupper" },
  { id: "kalender", label: "Kalender", icon: Calendar, module: "kalender" },
  { id: "gudstjenester", label: "Gudstjenester", icon: Church, module: "gudstjenesteplan" },
];

/** The tabs that are on (see utils/minSideModules.ts). A tab whose module is off is not in the list. */
export function shownMyPageTabs(isOn: (id: MinSideModuleId) => boolean): MyPageTabDef[] {
  return MY_PAGE_TABS.filter((tab) => !tab.module || isOn(tab.module));
}

/** The tab an address asks for (`?view=`). Tasks when it asks for none: they are what a volunteer comes for. */
export function toMyPageTab(value: string | null): MyPageTab {
  return MY_PAGE_TABS.find((tab) => tab.id === value)?.id ?? "oppgaver";
}

interface MyPageTabsProps {
  active: MyPageTab;
  onChange: (tab: MyPageTab) => void;
  /** The tabs to show. All of them when not given. */
  tabs?: MyPageTabDef[];
}

/**
 * The tabs twice, one of them shown at a time: under the heading on a wide screen, and fixed to
 * the bottom of a phone, where a thumb reaches them. No number stands on a tab: the tasks are
 * counted where they are listed, and two numbers for the same thing only confuse.
 */
export const MyPageTabs: React.FC<MyPageTabsProps> = ({ active, onChange, tabs = MY_PAGE_TABS }) => {
  return (
    <>
      {/* Under the heading on a tablet. On a PC the same parts are the column to the left (MyPageSideMenu) */}
      <div role="tablist" aria-label="Min side" aria-orientation="horizontal" className="hidden sm:flex lg:hidden items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200/80">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => onChange(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              active === id ? "bg-primary-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <nav
        id="mobile-bottom-navigation"
        aria-label="Min side"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-lg flex items-stretch justify-around sm:hidden"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            id={`mobile-nav-${id}`}
            aria-current={active === id ? "page" : undefined}
            onClick={() => onChange(id)}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
              active === id ? "text-primary-800 font-bold bg-primary-50" : "text-slate-600 font-medium"
            }`}
          >
            <Icon className={`w-5 h-5 ${active === id ? "text-primary-700" : "text-slate-500"}`} />
            <span className="block max-w-full truncate text-[11px] tracking-tight">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
