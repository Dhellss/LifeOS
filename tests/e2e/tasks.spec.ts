import { expect, test } from '@playwright/test';

import {
  chooseOption,
  dialog,
  dialogField,
  expectToast,
  navigateTo,
  newAccount,
  register,
} from './fixtures';

const account = newAccount('tasks');

test.describe('tasks and projects', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await register(page, account);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    const { login } = await import('./fixtures');
    await login(page, account);
  });

  test('an empty workspace shows a real empty state, not fake numbers', async ({ page }) => {
    await navigateTo(page, 'Tasks', 'Tasks');
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create a task' })).toBeVisible();
  });

  test('a task can be created, completed and deleted', async ({ page }) => {
    await navigateTo(page, 'Tasks', 'Tasks');

    // Create
    await page.getByRole('button', { name: 'New task' }).click();
    await dialogField(page, 'Title').fill('Write the integration guide');
    await dialogField(page, 'Description').fill('Cover the migration and seed steps.');
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');
    await expect(page.getByText('Write the integration guide')).toBeVisible();

    // Complete via the checkbox and confirm the XP toast
    await page
      .getByRole('checkbox', { name: 'Mark "Write the integration guide" as done' })
      .click();
    await expectToast(page, 'Task completed');

    // The completion survives a reload, so it was persisted server-side.
    await page.reload();
    await expect(
      page.getByRole('checkbox', { name: 'Mark "Write the integration guide" as not done' }),
    ).toBeChecked();
    await expect(page.getByText('Done', { exact: true })).toBeVisible();

    // Delete
    await page.getByRole('button', { name: 'Delete "Write the integration guide"' }).click();
    await dialog(page).getByRole('button', { name: 'Delete task' }).click();
    await expectToast(page, 'Task deleted');
    await expect(page.getByText('Write the integration guide')).toHaveCount(0);
  });

  test('task validation is enforced before anything is saved', async ({ page }) => {
    await navigateTo(page, 'Tasks', 'Tasks');
    await page.getByRole('button', { name: 'New task' }).click();
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByText('Title is required.')).toBeVisible();
  });

  test('a task can be edited and its priority changed', async ({ page }) => {
    await navigateTo(page, 'Tasks', 'Tasks');

    await page.getByRole('button', { name: 'New task' }).click();
    await dialogField(page, 'Title').fill('Draft release notes');
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    await page.getByRole('button', { name: 'Edit "Draft release notes"' }).click();
    await dialogField(page, 'Title').fill('Draft release notes v2');
    await chooseOption(page, 'Priority', 'Urgent', dialog(page));
    await dialog(page).getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Task updated');

    await page.reload();
    await expect(page.getByText('Draft release notes v2')).toBeVisible();
    await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();
  });

  test('status filtering re-queries on the server and is shareable via the URL', async ({
    page,
  }) => {
    await navigateTo(page, 'Tasks', 'Tasks');

    await page.getByRole('button', { name: 'New task' }).click();
    await dialogField(page, 'Title').fill('Only in progress task');
    await chooseOption(page, 'Status', 'In progress', dialog(page));
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    await chooseOption(page, 'Filter by status', 'To do');
    await expect(page).toHaveURL(/status=TODO/);
    await expect(page.getByText('Only in progress task')).toHaveCount(0);

    // The filter is in the URL, so it survives a hard navigation.
    await page.goto('/tasks?status=IN_PROGRESS');
    await expect(page.getByText('Only in progress task')).toBeVisible();
  });

  test('a project can be created and a task linked to it drives its progress', async ({ page }) => {
    await navigateTo(page, 'Projects', 'Projects');

    await page.getByRole('button', { name: 'New project' }).click();
    await dialogField(page, 'Name').fill('Launch checklist');
    await dialogField(page, 'Description').fill('Everything needed before shipping.');
    await dialog(page).getByRole('button', { name: 'Create project' }).click();
    await expectToast(page, 'Project created');
    await expect(page.getByText('Launch checklist')).toBeVisible();

    // Open the detail page and add two tasks.
    await page.getByRole('link', { name: 'Launch checklist' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Launch checklist' })).toBeVisible();
    await expect(page.getByText('No tasks linked yet')).toBeVisible();

    await page.getByRole('button', { name: 'Add the first task' }).click();
    await dialogField(page, 'Title').fill('Audit the env vars');
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    await page.getByRole('button', { name: 'Add task' }).click();
    await dialogField(page, 'Title').fill('Smoke-test production');
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    await expect(page.getByText('Audit the env vars')).toBeVisible();
    await expect(page.getByText('Smoke-test production')).toBeVisible();

    // Completing one of two tasks must put progress at exactly 50%.
    await page.getByRole('checkbox', { name: 'Mark "Audit the env vars" as done' }).click();
    await expectToast(page, 'Task completed');
    await page.reload();
    await expect(page.getByText('1 of 2 done')).toBeVisible();
    await expect(page.getByText('50%', { exact: true }).first()).toBeVisible();
  });

  test('completing a project closes its open tasks', async ({ page }) => {
    await navigateTo(page, 'Projects', 'Projects');

    await page.getByRole('button', { name: 'New project' }).click();
    await dialogField(page, 'Name').fill('Finishable project');
    await dialog(page).getByRole('button', { name: 'Create project' }).click();
    await expectToast(page, 'Project created');

    await page.getByRole('link', { name: 'Finishable project' }).click();
    await page.getByRole('button', { name: 'Add the first task' }).click();
    await dialogField(page, 'Title').fill('Last loose end');
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    await navigateTo(page, 'Projects', 'Projects');
    await page.getByRole('button', { name: 'Actions for Finishable project' }).click();
    await page.getByRole('menuitem', { name: 'Complete project' }).click();
    await expectToast(page, /Project completed/);

    // Reach the completed list through the status filter rather than by URL, so
    // the filter control itself is covered.
    const statuses = page.getByRole('navigation', { name: 'Filter projects by status' });
    await statuses.getByRole('link', { name: 'Completed' }).click();
    await expect(page).toHaveURL(/status=COMPLETED/);
    await expect(page.getByText('Finishable project')).toBeVisible();

    // A second click must also navigate: an earlier implementation dropped it.
    await statuses.getByRole('link', { name: 'Active' }).click();
    await expect(page).toHaveURL(/status=ACTIVE/);
    await expect(page.getByText('Finishable project')).toHaveCount(0);

    await page.goto('/projects?status=COMPLETED');

    await page.getByRole('link', { name: 'Finishable project' }).click();
    await expect(page.getByText('1 of 1 done')).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Mark "Last loose end" as not done' }),
    ).toBeChecked();
  });
});
