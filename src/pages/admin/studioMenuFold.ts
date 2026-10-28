import { useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

/** The key of the choice the user makes with the fold button. Absent = the menu follows the screen (see below). */
export const MENU_FOLD_KEY = "menighetsplan:admin-meny";

export type MenuChoice = "open" | "folded";

// Storage can be blocked (private mode, settings), so every access is guarded: then the choice lasts until a reload
function readChoice(): MenuChoice | null {
  try {
    const value = window.localStorage.getItem(MENU_FOLD_KEY);
    return value === "open" || value === "folded" ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: MenuChoice): void {
  try {
    window.localStorage.setItem(MENU_FOLD_KEY, choice);
  } catch {
    // Storage is blocked: the choice simply lasts until the page is reloaded
  }
}

/**
 * Whether the admin side menu is folded to icons (from md up), and the button that changes it.
 * Without a choice of the user's own, the menu is folded while a page is edited, and on a screen narrower than xl.
 * The user's press is remembered in the browser, and follows the window when it is resized.
 */
export function useStudioMenuFold(editingPage: boolean): { folded: boolean; toggle: () => void } {
  // Where the browser cannot tell (a test, the server), the menu is open
  const wideScreen = useMediaQuery("(min-width: 1280px)");
  const [choice, setChoice] = useState<MenuChoice | null>(readChoice);
  const folded = choice ? choice === "folded" : editingPage || !wideScreen;
  const toggle = () => {
    const next: MenuChoice = folded ? "open" : "folded";
    setChoice(next);
    writeChoice(next);
  };
  return { folded, toggle };
}
