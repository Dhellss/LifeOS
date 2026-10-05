import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env', quiet: true });

/**
 * E2E configuration.
 *
 * The suite drives a real Next.js server against a real PostgreSQL database
 * (`TEST_DATABASE_URL`), exercising the full stack: Better Auth sessions,
 * route handlers, the service layer and Prisma.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for the E2E suite. See .env.example and docs/TESTING.md.',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  // Each spec registers its own user, so specs are independent; tests inside a
  // spec share that account and therefore run in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    testIdAttribute: 'data-testid',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Drive the full Chromium build rather than Playwright's separate
        // headless-shell binary, so the suite exercises the same engine a user
        // would run.
        channel: 'chromium',
      },
    },
  ],

  webServer: {
    // A production build is used so the suite matches what gets deployed.
    command: `npm run build && npx next start --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    // Always start a fresh server. Reusing one left over from an interrupted
    // run is a reliable way to spend an afternoon debugging a wedged process
    // rather than the application.
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-secret-0123456789abcdef',
      BETTER_AUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NODE_ENV: 'production',
      // The suite registers an account per test, which is well above the
      // credential rate limit a real deployment should keep enabled.
      AUTH_RATE_LIMIT_DISABLED: 'true',
    },
  },
});
