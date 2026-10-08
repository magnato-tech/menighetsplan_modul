import { readDemoInstallation } from "./installation";

/**
 * What the demo installation has that no other has, or null in a congregation's own
 * installation. Read once from the settings the app was built with, so it cannot be turned on
 * from a browser.
 */
export const DEMO = readDemoInstallation(import.meta.env);
