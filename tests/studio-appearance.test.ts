import { describe } from "vitest";
import { assert } from "./assert";
import {
  DEFAULT_STUDIO_THEME,
  loadStudioAppearance,
  parseStudioTheme,
  readStudioTheme,
  writeStudioTheme,
  STUDIO_APPEARANCE_EPOCH,
  STUDIO_APPEARANCE_EPOCH_KEY,
  STUDIO_SIDEBAR_THEME_KEY,
  STUDIO_CONTENT_THEME_KEY,
} from "../src/pages/admin/studioAppearance";

describe("Admin Studio-utseende", () => {
  const storage = {
    data: new Map<string, string>(),
    getItem(key: string) {
      return this.data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      this.data.set(key, value);
    },
    removeItem(key: string) {
      this.data.delete(key);
    },
    clear() {
      this.data.clear();
    },
    get length() {
      return this.data.size;
    },
    key() {
      return null;
    },
  } as Storage;

  assert(parseStudioTheme("light") === "light", "Parser lys modus");
  assert(parseStudioTheme("dark") === "dark", "Parser mørk modus");
  assert(parseStudioTheme("ukjent") === "light", "Ukjent verdi faller tilbake til lys");
  assert(parseStudioTheme(null) === "light", "Uten eget valg er admin lys");

  writeStudioTheme(STUDIO_SIDEBAR_THEME_KEY, "light", storage);
  assert(readStudioTheme(STUDIO_SIDEBAR_THEME_KEY, storage) === "light", "Lagrer sidemeny-tema");

  writeStudioTheme(STUDIO_CONTENT_THEME_KEY, "dark", storage);
  assert(readStudioTheme(STUDIO_CONTENT_THEME_KEY, storage) === "dark", "Lagrer innholds-tema uavhengig");

  storage.removeItem(STUDIO_APPEARANCE_EPOCH_KEY);
  writeStudioTheme(STUDIO_SIDEBAR_THEME_KEY, "dark", storage);
  writeStudioTheme(STUDIO_CONTENT_THEME_KEY, "dark", storage);
  const migrated = loadStudioAppearance(storage);
  assert(migrated.sidebarTheme === DEFAULT_STUDIO_THEME, "Ny epoke setter lys meny");
  assert(migrated.contentTheme === DEFAULT_STUDIO_THEME, "Ny epoke setter lyst innhold");
  storage.setItem(STUDIO_APPEARANCE_EPOCH_KEY, STUDIO_APPEARANCE_EPOCH);
  writeStudioTheme(STUDIO_CONTENT_THEME_KEY, "dark", storage);
  const saved = loadStudioAppearance(storage);
  assert(saved.contentTheme === "dark", "Valg beholdes etter epoke");
});
