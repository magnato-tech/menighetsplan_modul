// A yes/no choice remembered in the browser. Storage can be blocked (private mode, settings),
// so every access is guarded and the fallback is used instead of an error.

export function readStoredFlag(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    if (value === "1") return true;
    if (value === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Storage is blocked: the choice simply lasts until the page is reloaded
  }
}
