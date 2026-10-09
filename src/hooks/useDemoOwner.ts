import { useSyncExternalStore } from "react";
import { readDemoOwner, subscribeDemoOwner, type DemoOwnerStatus } from "../services/demoOwner";

/** Whether the one at this browser is the owner of the demo (see utils/demoOwner.ts). Never the owner outside the demo. */
export function useDemoOwner(): DemoOwnerStatus {
  return useSyncExternalStore(subscribeDemoOwner, readDemoOwner, () => "locked" as const);
}
