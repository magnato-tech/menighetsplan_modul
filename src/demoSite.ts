import { DEMO } from "./demo";
import { readChosenDemoSite } from "./services/demoSite";

/**
 * The congregation the visitor of the demo is looking at (see utils/demoSite.ts), or null: the
 * example congregation. Always null in a congregation's own installation, which never asks the
 * browser. Read once, when the app is loaded.
 */
export const DEMO_SITE: string | null = DEMO ? readChosenDemoSite() : null;
