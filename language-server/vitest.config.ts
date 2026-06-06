import { defineConfig } from 'vitest/config';

// Unit tests run directly against TS sources and need no build.
// The protocol integration suite is excluded here — it drives the compiled
// out/server.js and has its own config (vitest.integration.config.ts).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**', 'node_modules', 'out'],
  },
});
