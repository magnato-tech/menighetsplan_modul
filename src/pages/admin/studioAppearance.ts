import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type StudioTheme = "dark" | "light";

export const STUDIO_SIDEBAR_THEME_KEY = "menighetsplan_studio_sidebar";
export const STUDIO_CONTENT_THEME_KEY = "menighetsplan_studio_content";

export interface StudioAppearance {
  sidebarTheme: StudioTheme;
  contentTheme: StudioTheme;
  setSidebarTheme: (theme: StudioTheme) => void;
  setContentTheme: (theme: StudioTheme) => void;
  toggleSidebarTheme: () => void;
  toggleContentTheme: () => void;
}

export function parseStudioTheme(value: string | null): StudioTheme {
  // Light until the person has chosen dark themselves
  return value === "dark" ? "dark" : "light";
}

export function readStudioTheme(key: string, storage: Storage = localStorage): StudioTheme {
  return parseStudioTheme(storage.getItem(key));
}

export function writeStudioTheme(key: string, theme: StudioTheme, storage: Storage = localStorage): void {
  storage.setItem(key, theme);
}

function useStudioAppearanceState(): StudioAppearance {
  const [sidebarTheme, setSidebarThemeState] = useState<StudioTheme>(() =>
    readStudioTheme(STUDIO_SIDEBAR_THEME_KEY)
  );
  const [contentTheme, setContentThemeState] = useState<StudioTheme>(() =>
    readStudioTheme(STUDIO_CONTENT_THEME_KEY)
  );

  const setSidebarTheme = useCallback((theme: StudioTheme) => {
    setSidebarThemeState(theme);
    writeStudioTheme(STUDIO_SIDEBAR_THEME_KEY, theme);
  }, []);

  const setContentTheme = useCallback((theme: StudioTheme) => {
    setContentThemeState(theme);
    writeStudioTheme(STUDIO_CONTENT_THEME_KEY, theme);
  }, []);

  const toggleSidebarTheme = useCallback(() => {
    setSidebarTheme(sidebarTheme === "dark" ? "light" : "dark");
  }, [sidebarTheme, setSidebarTheme]);

  const toggleContentTheme = useCallback(() => {
    setContentTheme(contentTheme === "dark" ? "light" : "dark");
  }, [contentTheme, setContentTheme]);

  return useMemo(
    () => ({
      sidebarTheme,
      contentTheme,
      setSidebarTheme,
      setContentTheme,
      toggleSidebarTheme,
      toggleContentTheme,
    }),
    [sidebarTheme, contentTheme, setSidebarTheme, setContentTheme, toggleSidebarTheme, toggleContentTheme]
  );
}

const StudioAppearanceContext = createContext<StudioAppearance | null>(null);

export function StudioAppearanceProvider({ children }: { children: React.ReactNode }) {
  const appearance = useStudioAppearanceState();
  return React.createElement(StudioAppearanceContext.Provider, { value: appearance }, children);
}

export function useStudioAppearance(): StudioAppearance {
  const context = useContext(StudioAppearanceContext);
  if (!context) {
    throw new Error("useStudioAppearance må brukes innenfor StudioAppearanceProvider");
  }
  return context;
}
