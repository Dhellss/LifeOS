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

const account = newAccount('dashboard');

/**
 * End-to-end check that the dashboard, analytics and achievements pages are
 * reading live aggregates: numbers start at zero for a fresh account and move
 * only after real records are created.
 */
test.describe('dashboard, analytics and achievements', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await register(page, account);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, account);
  });

  test('a fresh account starts at level 1 with zero XP and honest empty states', async ({
    page,
  }) => {
    // The level badge sits in the sidebar's footer, below the nav, so it is
    // scoped to the <aside> landmark rather than to the navigation itself.
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toContainText('Level 1');
    await expect(sidebar).toContainText('0 XP');
    await expect(page.getByText('Nothing due today')).toBeVisible();
    await expect(page.getByText('No active projects')).toBeVisible();
    await expect(page.getByText('No habits yet')).toBeVisible();
    await expect(page.getByText('No activity yet')).toBeVisible();
  });

  test('completing real work moves the dashboard numbers and awards XP', async ({ page }) => {
    // Create a task due today, complete it, and log a study session.
    await navigateTo(page, 'Tasks', 'Tasks');
    await page.getByRole('button', { name: 'New task' }).click();
    await dialogField(page, 'Title').fill('Dashboard-driving task');
    await dialogField(page, 'Due date').fill(new Date().toISOString().slice(0, 10));
    await dialog(page).getByRole('button', { name: 'Create task' }).click();
    await expectToast(page, 'Task created');

    await page.getByRole('checkbox', { name: 'Mark "Dashboard-driving task" as done' }).click();
    await expectToast(page, 'Task completed');

    await navigateTo(page, 'Study', 'Study');
    await page.getByRole('button', { name: 'Log session' }).click();
    await dialogField(page, 'Subject').fill('Analytics Verification');
    await dialogField(page, 'Duration (minutes)').fill('60');
    await dialog(page).getByRole('button', { name: 'Log session' }).click();
    await expectToast(page, 'Study session logged');

    // The dashboard now reflects both, including XP from the task, the study
    // session and the achievements they unlocked.
    await page.goto('/dashboard');

    await expect(page.getByText('Completed today')).toBeVisible();
    await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1h', { exact: true }).first()).toBeVisible();

    // 10 XP for the task, 6 for 60 minutes of study, plus 50 each for the two
    // achievements those unlock - enough to cross into level 2.
    await expect(page.getByRole('complementary')).toContainText('Level 2');
  });

  test('analytics renders real charts for the selected range', async ({ page }) => {
    await navigateTo(page, 'Analytics', 'Analytics');

    await expect(page.getByRole('region', { name: 'Tasks completed over time' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'XP growth' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Study minutes per day' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Habit completion rate' })).toBeVisible();

    // The range switcher is a set of links, so each range is its own URL and
    // switching re-queries on the server.
    const ranges = page.getByRole('navigation', { name: 'Analytics range' });

    await ranges.getByRole('link', { name: '7 days' }).click();
    await expect(page).toHaveURL(/range=7/);
    await expect(page.getByText('Tasks completed (7d)')).toBeVisible();

    await ranges.getByRole('link', { name: '90 days' }).click();
    await expect(page).toHaveURL(/range=90/);
    await expect(page.getByText('Tasks completed (90d)')).toBeVisible();

    // Back again, to catch a switcher that only works on the first click.
    await ranges.getByRole('link', { name: '30 days' }).click();
    await expect(page).toHaveURL(/range=30/);
    await expect(page.getByText('Tasks completed (30d)')).toBeVisible();
  });

  test('achievements reflect the work actually done', async ({ page }) => {
    await navigateTo(page, 'Achievements', 'Achievements');

    // Earned from the earlier task and study session. Matched exactly, because
    // the recent-XP feed also mentions each title ('Unlocked achievement "…"').
    await expect(page.getByText('First Blood', { exact: true })).toBeVisible();
    await expect(page.getByText('Open Book', { exact: true })).toBeVisible();
    await expect(page.getByText('Unlocked', { exact: true }).first()).toBeVisible();

    // Not yet earned, and still shown with honest progress rather than hidden.
    await expect(page.getByText('Task Machine', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Still to earn').or(page.getByText('Available achievements')),
    ).toBeVisible();
  });

  test('settings exposes live row counts for the account', async ({ page }) => {
    await navigateTo(page, 'Settings', 'Settings');

    await expect(page.getByText(account.email)).toBeVisible();
    await expect(page.getByText('Your data')).toBeVisible();

    // The counts are a <dl>; each label is a <dt> with its value in the <dd>.
    await expect(page.getByRole('term').filter({ hasText: /^Tasks$/ })).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: /^Habit check-ins$/ })).toBeVisible();

    // Preferences persist through the API.
    await page.getByLabel('Daily task goal').fill('9');
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expectToast(page, 'Preferences saved');

    await page.reload();
    await expect(page.getByLabel('Daily task goal')).toHaveValue('9');

    await page.goto('/dashboard');
    await expect(page.getByText(/of your goal of 9/)).toBeVisible();
  });

  test('the app is usable at a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    // The sidebar collapses into a drawer.
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeHidden();

    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Tasks' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();

    // No horizontal overflow at this width.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(400);
  });
});
