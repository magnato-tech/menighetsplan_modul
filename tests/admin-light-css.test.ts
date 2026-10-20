import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// The admin tabs are written in a dark palette. «Lyst innhold» turns it light through
// src/admin-light.css, written by scripts/admin-light-css.py. A class in a dark hue added later
// without a line there would show dark on the white background.

const root = process.cwd();
const sources = [
  "src/pages/admin",
  "src/components/admin",
  "src/pages/AdminGroupDetailPage.tsx",
  "src/pages/AdminPersonDetailPage.tsx",
  "src/pages/AdminTaskDetailPage.tsx",
];
const files = (p: string): string[] => {
  const full = path.join(root, p);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => files(path.join(p, name)));
};
const hues = "slate|gray|zinc|stone|neutral|red|rose|pink|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia";
const dark = new RegExp(
  `\\b((?:hover|group-hover|focus):)?(bg-(?:${hues})-(?:950|900|800|700)|text-(?:${hues})-(?:100|200|300|400)|border-(?:${hues})-(?:700|800|900))(\\/\\d+)?\\b`,
  "g"
);
const css = readFileSync(path.join(root, "src/admin-light.css"), "utf8");
const escaped = (token: string) => "." + token.replace(/([:/.])/g, "\\$1");

describe("Lyst innhold i admin", () => {
  const used = new Set(sources.flatMap(files).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")).flatMap((f) => readFileSync(f, "utf8").match(dark) ?? []));

  test("hver klasse i en mørk farge har en lys utgave", () => {
    const missing = [...used].filter((token) => !css.includes(escaped(token)));
    expect(missing).toEqual([]);
  });

  test("forhåndsvisningen av nettsiden og visninger tegnet for lys bakgrunn beholder fargene sine", () => {
    expect(css).toContain(':not(.site-theme *, [data-ui="light"] *)');
  });
});
