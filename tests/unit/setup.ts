/**
 * Unit-test setup.
 *
 * The unit suite covers pure domain logic, so it must never touch a database.
 * `DATABASE_URL` is still set because importing anything under `lib/` can pull
 * in `lib/env.ts` transitively, and the schema validation there runs eagerly.
 */
process.env.DATABASE_URL ??= 'postgresql://unit-tests@localhost:5432/unused';
process.env.BETTER_AUTH_SECRET ??= 'unit-test-secret-value-0123456789';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
