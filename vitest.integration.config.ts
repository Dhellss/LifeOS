import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Integration suite: runs the real service layer against a real PostgreSQL
 * database (`TEST_DATABASE_URL`). These tests assert the guarantees that only
 * the database can enforce — ownership scoping, unique constraints and the XP
 * dedupe index.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    // Each file seeds and tears down its own users; running them serially keeps
    // the assertions on global row counts deterministic.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
