import { parseLevel, type Level } from "../utils/level";

// The level a visitor of the demo has chosen to look at. It is kept in the visitor's own
// browser, so one visitor's choice never changes what another sees. Only the demo installation
// asks for it (see hooks/useLevel.ts).

const KEY = "menighetsplan_demo_nivaa";

const listeners = new Set<() => void>();
// What was chosen in this tab. It stands in for the storage where the browser blocks it.
let chosenHere: Level | undefined;

function stored(): Level | null {
  try {
    return parseLevel(window.localStorage.getItem(KEY));
  } catch {
    // Blocked storage only means the choice is not remembered when the page is loaded again
    return null;
  }
}

/** The level the visitor has chosen, or null when no choice is made. */
export function readDemoLevel(): Level | null {
  return chosenHere ?? stored();
}

export function chooseDemoLevel(level: Level): void {
  chosenHere = level;
  try {
    window.localStorage.setItem(KEY, level);
  } catch {
    // See stored(): the choice still holds for as long as the tab is open
  }
  listeners.forEach((listener) => listener());
}

// A choice made in another tab of the same browser is followed here too
function followOtherTabs(event: StorageEvent): void {
  if (event.key !== KEY) return;
  chosenHere = undefined;
  listeners.forEach((listener) => listener());
}

/** Tells the listener when the choice changes. Returns the function that stops telling. */
export function subscribeDemoLevel(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", followOtherTabs);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", followOtherTabs);
  };
}

/** Forgets the choice, as in a browser that has not been in the demo before. */
export function forgetDemoLevel(): void {
  chosenHere = undefined;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored that could be removed
  }
  listeners.forEach((listener) => listener());
}
