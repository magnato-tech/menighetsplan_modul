import { DEMO } from "../demo";
import { isOwnerCode } from "../utils/demoOwner";

// Whether the one at this browser is the owner of the demo (see utils/demoOwner.ts). The code
// the owner has typed is kept in their own browser and tried against the settings each time the
// app is loaded, so a mark in the browser's storage alone makes nobody the owner.

const KEY = "menighetsplan_demo_eier";

/** "checking" until the stored code has been tried. */
export type DemoOwnerStatus = "checking" | "locked" | "owner";

let status: DemoOwnerStatus = "checking";
let started = false;
const listeners = new Set<() => void>();

function set(next: DemoOwnerStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function stored(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

async function tryStoredCode(): Promise<void> {
  const code = stored();
  set(code && (await isOwnerCode(code, DEMO?.ownerCodeHash)) ? "owner" : "locked");
}

/** Whether the demo has an owner's code at all. Without one, nobody can be let in as the owner. */
export const isDemoOwnerSetUp = (): boolean => Boolean(DEMO?.ownerCodeHash);

export const readDemoOwner = (): DemoOwnerStatus => status;

/** Tells the listener when the answer changes. Returns the function that stops telling. */
export function subscribeDemoOwner(listener: () => void): () => void {
  if (!started) {
    started = true;
    void tryStoredCode().catch(() => set("locked"));
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tries a code. The right one is remembered in this browser, and the one typing it is the owner from then on. */
export async function unlockDemoOwner(code: string): Promise<boolean> {
  if (!(await isOwnerCode(code, DEMO?.ownerCodeHash))) return false;
  try {
    window.localStorage.setItem(KEY, code.trim());
  } catch {
    // Blocked storage only means the code must be typed again when the page is loaded anew
  }
  set("owner");
  return true;
}

/** Forgets the code in this browser. */
export function lockDemoOwner(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored that could be removed
  }
  set("locked");
}
