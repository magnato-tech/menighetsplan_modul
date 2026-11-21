import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type StudioTheme = "dark" | "light";

/** Standard for hele Admin Studio (meny og innhold). */
export const DEFAULT_STUDIO_THEME: StudioTheme = "light";

export const STUDIO_SIDEBAR_THEME_KEY = "menighetsplan_studio_sidebar";
export const STUDIO_CONTENT_THEME_KEY = "menighetsplan_studio_content";
/** Bumper når standard utseende endres, så alle får lys modus én gang. */
export const STUDIO_APPEARANCE_EPOCH_KEY = "menighetsplan_studio_epoch";
export const STUDIO_APPEARANCE_EPOCH = "2";

export interface StudioAppearance {
  sidebarTheme: StudioTheme;
  contentTheme: StudioTheme;
  setSidebarTheme: (theme: StudioTheme) => void;
  setContentTheme: (theme: StudioTheme) => void;
  toggleSidebarTheme: () => void;
  toggleContentTheme: () => void;
}

export function parseStudioTheme(value: string | null): StudioTheme {
  return value === "dark" ? "dark" : DEFAULT_STUDIO_THEME;
}

export function readStudioTheme(key: string, storage: Storage = localStorage): StudioTheme {
  return parseStudioTheme(storage.getItem(key));
}

export function writeStudioTheme(key: string, theme: StudioTheme, storage: Storage = localStorage): void {
  storage.setItem(key, theme);
}

/** Leser lagret tema, eller setter lys standard når epoken mangler (første besøk / etter oppgradering). */
export function loadStudioAppearance(storage: Storage = localStorage): { sidebarTheme: StudioTheme; contentTheme: StudioTheme } {
  if (storage.getItem(STUDIO_APPEARANCE_EPOCH_KEY) !== STUDIO_APPEARANCE_EPOCH) {
    writeStudioTheme(STUDIO_SIDEBAR_THEME_KEY, DEFAULT_STUDIO_THEME, storage);
    writeStudioTheme(STUDIO_CONTENT_THEME_KEY, DEFAULT_STUDIO_THEME, storage);
    storage.setItem(STUDIO_APPEARANCE_EPOCH_KEY, STUDIO_APPEARANCE_EPOCH);
    return { sidebarTheme: DEFAULT_STUDIO_THEME, contentTheme: DEFAULT_STUDIO_THEME };
  }
  return {
    sidebarTheme: readStudioTheme(STUDIO_SIDEBAR_THEME_KEY, storage),
    contentTheme: readStudioTheme(STUDIO_CONTENT_THEME_KEY, storage),
  };
}

function useStudioAppearanceState(): StudioAppearance {
  const [sidebarTheme, setSidebarThemeState] = useState<StudioTheme>(
    () => loadStudioAppearance().sidebarTheme
  );
  const [contentTheme, setContentThemeState] = useState<StudioTheme>(
    () => loadStudioAppearance().contentTheme
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
