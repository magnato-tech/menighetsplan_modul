import React from "react";
import type { MyPageTab, MyPageTabDef } from "./MyPageTabs";

interface MyPageSideMenuProps {
  active: MyPageTab;
  onChange: (tab: MyPageTab) => void;
  /** The tabs to show. All of them when not given. */
  tabs: MyPageTabDef[];
}

/**
 * The parts of Min side as a vertical menu in a column to the left, on a PC (lg and wider).
 * It stays in view while the page is scrolled. Narrower screens have MyPageTabs instead.
 */
export const MyPageSideMenu: React.FC<MyPageSideMenuProps> = ({ active, onChange, tabs }) => {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Min side"
      className="hidden lg:flex flex-col gap-1 p-1.5 rounded-2xl bg-white border border-slate-200/80"
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
            active === id ? "bg-primary-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};
