import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCms } from "../../context/CmsContext";
import { useFirebase } from "../../context/FirebaseDataContext";
import { buildPublicMenu, pageUrl } from "../../utils/menu";
import {
  Menu,
  X,
  Church,
  LayoutDashboard,
  Shield,
  ChevronRight,
} from "lucide-react";

export const PublicNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileSubmenus, setOpenMobileSubmenus] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { settings, pages } = useCms();
  const { currentUser } = useFirebase();

  const isAdmin = currentUser?.globalRole === "admin";

  // On the front page the menu lies on top of the hero image, and turns into the usual white bar
  // once the visitor scrolls or opens the menu. The page can switch this off (Page.heroMenuOverlay).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const homePage = pages.find((p) => p.slug === "" || p.linkUrl === "/");
  const isPreview = /[?&](preview=true|embedded=1)/.test(location.search);
  const onHero = location.pathname === "/" && Boolean(homePage?.heroImage) && homePage?.heroMenuOverlay !== false && !isPreview;
  const overlay = onHero && !scrolled && !mobileMenuOpen;
  const linkIdle = overlay ? "text-white/90 hover:text-white hover:bg-white/15" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70";
  const linkActive = overlay ? "text-white bg-white/20 font-bold" : "text-primary-900 bg-primary-50/80 font-bold";

  const toggleMobileSubmenu = (pageId: string) => {
    setOpenMobileSubmenus((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  };

  // The menu tree with a link and an active marker on every entry
  const navigationItems = useMemo(
    () =>
      buildPublicMenu(pages).map(({ page, children }) => {
        const targetUrl = pageUrl(page);
        const items = children.map((child) => {
          const childUrl = pageUrl(child);
          return { page: child, targetUrl: childUrl, isActive: location.pathname === childUrl };
        });
        const isActive =
          location.pathname === targetUrl ||
          (targetUrl !== "/" && location.pathname.startsWith(targetUrl)) ||
          items.some((item) => item.isActive);

        return { page, targetUrl, isActive, children: items };
      }),
    [pages, location.pathname]
  );

  return (
    <header
      data-menu-on-hero={overlay ? "true" : undefined}
      className={`${onHero ? "fixed inset-x-0" : "sticky"} top-[var(--demo-strip,0px)] z-50 border-b transition-colors duration-300 ${
        overlay
          ? "bg-gradient-to-b from-stone-950/75 to-transparent border-transparent"
          : "bg-white/95 backdrop-blur-md border-stone-200/80 shadow-xs"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand Name */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <Church className="w-5 h-5 text-accent-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black tracking-tight transition-colors ${overlay ? "text-white" : "text-slate-900 group-hover:text-primary-950"}`}>
                  {settings.appName || "Menighetsplan"}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200/60">
                  {settings.churchName}
                </span>
              </div>
              {settings.tagline && (
                <p className={`text-xs hidden sm:block font-medium ${overlay ? "text-stone-200" : "text-stone-500"}`}>
                  {settings.tagline}
                </p>
              )}
            </div>
          </Link>

          {/* Desktop Navigation Links with Dropdown for Subpages */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navigationItems.map((item) => {
              if (item.children.length === 0) {
                return (
                  <Link
                    key={item.page.id}
                    to={item.targetUrl}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      item.isActive
                        ? linkActive
                        : linkIdle
                    }`}
                  >
                    {item.page.title}
                  </Link>
                );
              }

              return (
                <div className="relative group" key={item.page.id}>
                  <Link
                    to={item.targetUrl}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      item.isActive
                        ? linkActive
                        : linkIdle
                    }`}
                  >
                    <span>{item.page.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400 rotate-90 group-hover:rotate-270 group-hover:text-primary-700 transition-transform" />
                  </Link>

                  {/* Dropdown Menu */}
                  <div className="absolute left-0 top-full pt-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50">
                    <div className="bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200/90 py-2 min-w-[210px] space-y-0.5">
                      <Link
                        to={item.targetUrl}
                        className="block px-3.5 py-2 text-xs font-bold text-stone-900 hover:bg-primary-50/80 hover:text-primary-900 rounded-lg mx-1.5 transition-colors border-b border-stone-100 mb-1"
                      >
                        Oversikt: {item.page.title}
                      </Link>
                      {item.children.map((child) => (
                        <Link
                          key={child.page.id}
                          to={child.targetUrl}
                          className={`block px-3.5 py-2 text-xs font-medium rounded-lg mx-1.5 transition-colors ${
                            child.isActive
                              ? "bg-primary-50 text-primary-950 font-bold"
                              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/80"
                          }`}
                        >
                          {child.page.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Right Action buttons: Min Side & Admin Studio */}
          <div className="hidden sm:flex items-center gap-2.5">
            

            {/* Min Side Link */}
            <Link
              to="/minside"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs hover:shadow transition-all"
              title="Gå til Min Side for planlegging og oppgaver"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-accent-300" />
              <span>Min Side</span>
            </Link>

            {/* Admin Studio Button (Shown to Admins) */}
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold shadow-xs hover:shadow transition-all"
                title="Åpne Fullskjerm Admin & CMS Workspace"
              >
                <Shield className="w-3.5 h-3.5 text-accent-200" />
                <span>Admin Studio</span>
              </Link>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/minside"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
            >
              Min Side
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg ${overlay ? "text-white hover:bg-white/15" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"}`}
              aria-label="Åpne meny"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg max-h-[80vh] overflow-y-auto">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const hasSub = item.children.length > 0;
              const isExpanded = openMobileSubmenus[item.page.id] ?? item.isActive;

              return (
                <div key={item.page.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Link
                      to={item.targetUrl}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                        item.isActive
                          ? "bg-primary-50 text-primary-900 font-bold"
                          : "text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {item.page.title}
                    </Link>

                    {hasSub && (
                      <button
                        type="button"
                        onClick={() => toggleMobileSubmenu(item.page.id)}
                        className="p-2 text-stone-500 hover:text-stone-900 rounded-lg"
                        aria-label="Fold ut underfane"
                      >
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90 text-primary-600" : ""}`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Mobile Submenu Accordion */}
                  {hasSub && isExpanded && (
                    <div className="pl-4 ml-2 border-l-2 border-primary-100 space-y-1 pb-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.page.id}
                          to={child.targetUrl}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`block px-3 py-1.5 rounded-lg text-xs font-medium ${
                            child.isActive
                              ? "bg-primary-50 text-primary-950 font-bold"
                              : "text-stone-600 hover:bg-stone-50"
                          }`}
                        >
                          {child.page.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-stone-100 space-y-2">
            <Link
              to="/minside"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-sm"
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-accent-300" />
                <span>Gå til Min Side (Planlegger)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-primary-700 text-white text-sm font-bold shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent-200" />
                  <span>Admin & CMS Studio</span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary-200" />
              </Link>
            )}

            
          </div>
        </div>
      )}
    </header>
  );
};
