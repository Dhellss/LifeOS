/**
 * Point Prisma at the dedicated test database before any module imports it.
 *
 * `TEST_DATABASE_URL` must differ from `DATABASE_URL`; the guard below refuses
 * to run rather than risk truncating a development database.
 */
import { config } from 'dotenv';

config({ path: '.env', quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Copy .env.example to .env and point it at a scratch database.',
  );
}
if (testUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must not be the same database as DATABASE_URL.');
}

process.env.DATABASE_URL = testUrl;
process.env.BETTER_AUTH_SECRET ??= 'integration-test-secret-0123456789';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
