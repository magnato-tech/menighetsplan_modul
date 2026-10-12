import { defineConfig } from "vitest/config";

// The two files share the emulators, and each empties them before a test: one at a time.
export default defineConfig({
  test: {
    include: ["*.rules.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
