import { readDemoInstallation } from "./installation";

/**
 * What the demo installation has that no other has, or null in a congregation's own
 * installation. Read once from the settings the app was built with, so it cannot be turned on
 * from a browser. A script outside the app has no such settings, and is never the demo.
 */
export const DEMO = readDemoInstallation(import.meta.env ?? {});
