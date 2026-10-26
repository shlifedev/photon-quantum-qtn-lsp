import { defineConfig } from 'vitest/config';

// Integration suite spawns the real compiled server (out/server.js) and talks
// to it over the LSP wire — the exact contract VSCode, Visual Studio, and Rider
// all invoke. globalSetup rebuilds the server first so the test never runs
// against a stale artifact. Spawning + protocol round-trips are slower than the
// unit tests, hence the longer timeouts.
export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
