import { expect, test } from '@playwright/test';

import {
  dialog,
  dialogField,
  expectToast,
  login,
  navigateTo,
  newAccount,
  register,
} from './fixtures';

const alice = newAccount('alice');
const bob = newAccount('bob');

/**
 * Cross-user isolation, end to end.
 *
 * The service layer is unit-tested for ownership scoping; this spec proves the
 * same guarantee holds through the HTTP surface and the rendered pages, which
 * is what an attacker would actually reach.
 */
// These tests build on each other: Alice creates records, Bob tries to reach
// them, then Alice checks nothing changed. Serial mode keeps them in one worker
// and skips the rest on a failure, so the first real cause is the one reported.
test.describe.configure({ mode: 'serial' });

test.describe('cross-user isolation', () => {
  let aliceTaskId = '';
  let aliceProjectId = '';

  test('Alice creates private records', async ({ page }) => {
    await register(page, alice);

    await navigateTo(page, 'Projects', 'Projects');
    await page.getByRole('button', { name: 'New project' }).click();
    await dialogField(page, 'Name').fill("Alice's private project");
    await dialog(page).getByRole('button', { name: 'Create project' }).click();
    await expectToast(page, 'Project created');

    await page.getByRole('link', { name: "Alice's private project" }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/);
    aliceProjectId = page.url().split('/').pop()!;

    await navigateTo(page, 'Tasks', 'Tasks');
    await page.getByRole('button', { name: 'New task' }).click();
    await dialogField(page, 'Title').fill("Alice's private task");
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    // Read the id back through the API so the next test can try to reach it.
    const response = await page.request.get('/api/tasks');
    const body = (await response.json()) as { data: { id: string; title: string }[] };
    aliceTaskId = body.data.find((task) => task.title === "Alice's private task")!.id;
    expect(aliceTaskId).toBeTruthy();
  });

  test("Bob cannot see or reach Alice's records", async ({ page }) => {
    await register(page, bob);

    // Nothing of Alice's leaks into Bob's lists.
    await navigateTo(page, 'Tasks', 'Tasks');
    await expect(page.getByText("Alice's private task")).toHaveCount(0);
    await navigateTo(page, 'Projects', 'Projects');
    await expect(page.getByText("Alice's private project")).toHaveCount(0);

    // A direct URL to Alice's project detail page 404s rather than rendering.
    await page.goto(`/projects/${aliceProjectId}`);
    await expect(page.getByText('This page does not exist')).toBeVisible();

    // The API refuses reads, writes and deletes for a foreign id.
    const read = await page.request.get(`/api/tasks/${aliceTaskId}`);
    expect(read.status()).toBe(404);

    const write = await page.request.patch(`/api/tasks/${aliceTaskId}`, {
      data: { title: 'Hijacked by Bob' },
    });
    expect(write.status()).toBe(404);

    const remove = await page.request.delete(`/api/tasks/${aliceTaskId}`);
    expect(remove.status()).toBe(404);

    const foreignProject = await page.request.get(`/api/projects/${aliceProjectId}`);
    expect(foreignProject.status()).toBe(404);
  });

  test("Alice's records are untouched", async ({ page }) => {
    await login(page, alice);
    await navigateTo(page, 'Tasks', 'Tasks');
    await expect(page.getByText("Alice's private task")).toBeVisible();
    await expect(page.getByText('Hijacked by Bob')).toHaveCount(0);
  });

  test('the API rejects unauthenticated requests', async ({ request }) => {
    for (const path of [
      '/api/tasks',
      '/api/projects',
      '/api/habits',
      '/api/study',
      '/api/fitness',
      '/api/calendar',
      '/api/journal',
      '/api/settings',
    ]) {
      const response = await request.get(path);
      expect(response.status(), `${path} should require auth`).toBe(401);
    }
  });

  test('the API rejects invalid payloads with a 422 and field errors', async ({ page }) => {
    await login(page, alice);

    const response = await page.request.post('/api/tasks', { data: { title: '   ' } });
    expect(response.status()).toBe(422);

    const body = (await response.json()) as {
      error: { code: string; fieldErrors: Record<string, string[]> };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fieldErrors.title?.[0]).toBe('Title is required.');
  });

  test('the health endpoint reports database connectivity', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
  });
});
