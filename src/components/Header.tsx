import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { useCms } from "../context/CmsContext";
import { useLeaderDashboard } from "../hooks/useAppHooks";
import { Shield } from "lucide-react";

export const Header: React.FC = () => {
  const { settings } = useCms();
  const location = useLocation();
  const { isLeader, urgentGatherings, currentUser } = useLeaderDashboard();

  const isAdmin = currentUser.globalRole === "admin";

  const isLeaderPath = location.pathname.startsWith("/leder");
  const isAdminPath = location.pathname.startsWith("/admin");
  const isMyPagePath = location.pathname === "/minside" || location.pathname === "/";

  return (
    <header className="sticky top-[var(--demo-strip,0px)] z-40 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-md mx-auto px-5 pt-3 pb-2">
        <div className="flex items-center justify-between">
          {/* The congregation's own name, which leads to its website. The name of the product is not written here. */}
          <Link
            to="/"
            id="app-logo-link"
            title="Til nettsiden"
            className="flex flex-col items-start gap-0.5 min-w-0 group transition-opacity hover:opacity-90"
          >
            <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight group-hover:underline underline-offset-2">
              {settings.churchName || "Menighetsplan"}
            </h1>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Min Side</span>
          </Link>

          {/* Who is signed in, and the way out */}
          <AccountMenu />
        </div>

        {/* Navigation Tabs (Min side / Gruppeleder / Admin Studio) */}
        <nav className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100/80 overflow-x-auto pb-0.5 scrollbar-none">
          <Link
            to="/minside"
            id="nav-tab-min-side"
            className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
              isMyPagePath
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Min side
          </Link>

          {isLeader && (
            <Link
              to="/leder"
              id="nav-tab-leder"
              className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isLeaderPath
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              <span>Gruppeleder</span>
              {urgentGatherings.length > 0 && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLeaderPath ? "bg-amber-300" : "bg-red-500"
                  } animate-pulse`}
                  title="Trenger vikar"
                />
              )}
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              id="nav-tab-admin"
              className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isAdminPath
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/60"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin & CMS Studio</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
