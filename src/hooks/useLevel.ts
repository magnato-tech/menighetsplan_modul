import { useSyncExternalStore } from "react";
import { DEMO } from "../demo";
import { readDemoLevel, subscribeDemoLevel } from "../services/demoLevel";
import { installationLevel, type Level } from "../utils/level";

/**
 * The level the app is shown at (see utils/level.ts). Every screen that differs between the
 * levels asks here, so the visitor's choice in the demo changes all of them at once.
 */
export function useLevel(): Level {
  const chosen = useSyncExternalStore(subscribeDemoLevel, readDemoLevel, () => null);
  return installationLevel(DEMO !== null, chosen);
}
