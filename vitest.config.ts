import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Only the pure domain logic is measured. Services, route handlers and
      // React components do I/O or render, and are covered by the integration
      // and Playwright suites instead - including them here would reward
      // shallow mock-heavy tests and make the number mean less.
      include: [
        'lib/achievements.ts',
        'lib/dates.ts',
        'lib/progress.ts',
        'lib/series.ts',
        'lib/streaks.ts',
        'lib/utils.ts',
        'lib/validations/**/*.ts',
        'lib/xp.ts',
      ],
      // Set just under what the suite actually achieves, so a real regression
      // trips the gate rather than being averaged away.
      thresholds: {
        statements: 95,
        branches: 92,
        functions: 90,
        lines: 95,
      },
    },
  },
});
