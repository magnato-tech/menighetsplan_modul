import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { ChurchSiteLink } from "./ChurchSiteLink";
import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { Flag, Shield } from "lucide-react";
import { useMySemesterPlans } from "../hooks/useSemesterPlans";
import { useMinSideModules } from "../hooks/useMinSideModules";
import { logoOf } from "../utils/logo";

export const Header: React.FC = () => {
  const { settings, surfaces } = useCms();
  const location = useLocation();
  const { currentUser } = useFirebase();

  // The way into the admin: for administrators, and for web editors, who get its website part
  const isAdmin = currentUser.globalRole === "admin" || currentUser.globalRole === "nettredaktor";

  const isAdminPath = location.pathname.startsWith("/admin");
  const isMyPagePath = location.pathname === "/minside" || location.pathname.startsWith("/minside/") || location.pathname === "/";
  // A semester plan waiting for the person: the flag by Min side stays until they have gone through it
  const { isOn } = useMinSideModules();
  const { mine: semesterPlans } = useMySemesterPlans(isOn("semesterplan"));
  const planWaits = semesterPlans.some((item) => item.waiting);
  // The congregation's logo stands before its name, when there is one
  const logo = logoOf(settings);

  return (
    <header className="sticky top-[var(--demo-strip,0px)] z-40 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-md mx-auto px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          {/* The congregation's own name, which leads to its website. The name of the product is not written here. */}
          <ChurchSiteLink
            id="app-logo-link"
            title="Til nettsiden"
            textWithoutSite
            className="min-w-0 group transition-opacity hover:opacity-90"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {logo && <img src={logo} alt={settings.churchName} className="h-8 w-auto max-w-[9rem] object-contain shrink-0" />}
              <p className="text-lg font-bold text-slate-800 tracking-tight leading-tight truncate group-hover:underline underline-offset-2">
                {settings.churchName || "Menighetsplan"}
              </p>
            </div>
          </ChurchSiteLink>

          {/* Who is signed in, and the way out: behind the round mark with the initials */}
          <AccountMenu />
        </div>

        {/* Navigation Tabs (Min side / Admin Studio). The groups are on Min side, under Mine grupper */}
        <nav className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100/80 overflow-x-auto pb-0.5 scrollbar-none">
          {surfaces.minSide && (
          <Link
            to="/minside"
            id="nav-tab-min-side"
            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              isMyPagePath
                ? "bg-primary-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>Min side</span>
            {planWaits && (
              <Flag
                className={`w-3.5 h-3.5 ${isMyPagePath ? "text-amber-300" : "text-amber-600"}`}
                aria-label="Semesterplanen venter på deg"
              />
            )}
          </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              id="nav-tab-admin"
              className={`text-xs font-bold px-2.5 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isAdminPath
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/60"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
