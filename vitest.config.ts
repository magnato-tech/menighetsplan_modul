import react from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

// Kept apart from vite.config.ts, which AI Studio manages.
// Env files are not read from the project root: a developer's .env.local (VITE_DEMO=true)
// must not turn the test run into the demo.
export default defineConfig({
  plugins: [react()],
  envDir: 'tests/env',
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/tests/**/*.test.{ts,tsx}'],
  },
});
