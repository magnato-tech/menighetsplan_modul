import React from "react";
import { Calendar, ListTodo, Users } from "lucide-react";

// The three parts of Min side. The name of the one that is open, is the heading of the page.

export type MyPageTab = "oppgaver" | "grupper" | "kalender";

export const MY_PAGE_TABS: { id: MyPageTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "oppgaver", label: "Mine oppgaver", icon: ListTodo },
  { id: "grupper", label: "Mine grupper", icon: Users },
  { id: "kalender", label: "Kalender", icon: Calendar },
];

/** The tab an address asks for (`?view=`). Tasks when it asks for none: they are what a volunteer comes for. */
export function toMyPageTab(value: string | null): MyPageTab {
  return MY_PAGE_TABS.find((tab) => tab.id === value)?.id ?? "oppgaver";
}

interface MyPageTabsProps {
  active: MyPageTab;
  onChange: (tab: MyPageTab) => void;
}

/**
 * The tabs twice, one of them shown at a time: under the heading on a wide screen, and fixed to
 * the bottom of a phone, where a thumb reaches them. No number stands on a tab: the tasks are
 * counted where they are listed, and two numbers for the same thing only confuse.
 */
export const MyPageTabs: React.FC<MyPageTabsProps> = ({ active, onChange }) => {
  return (
    <>
      <div role="tablist" aria-label="Min side" className="hidden sm:flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200/80">
        {MY_PAGE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => onChange(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              active === id ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
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
        {MY_PAGE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            id={`mobile-nav-${id}`}
            aria-current={active === id ? "page" : undefined}
            onClick={() => onChange(id)}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
              active === id ? "text-emerald-800 font-bold bg-emerald-50" : "text-slate-600 font-medium"
            }`}
          >
            <Icon className={`w-5 h-5 ${active === id ? "text-emerald-700" : "text-slate-500"}`} />
            <span className="text-[11px] tracking-tight">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
