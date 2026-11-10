import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// What the hosting sends with every page and every answer (vercel.json)
describe("Sikkerhetshodene der løsningen er i drift", () => {
  const { headers } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const all = headers.find((rule) => rule.source === "/(.*)");
  const value = (key: string) => all?.headers.find((header) => header.key === key)?.value ?? "";

  test("ingen annen nettside kan legge appen inni seg, så ingen kan lure noen til å trykke i admin", () => {
    expect(value("Content-Security-Policy")).toMatch(/frame-ancestors 'self'/);
    expect(value("Content-Security-Policy")).not.toContain("frame-ancestors *");
  });

  test("filer leses som det de sier de er, og adressen deles ikke med andre nettsider", () => {
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(value("Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
  });
});
