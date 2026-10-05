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

const account = newAccount('tracking');

test.describe('habits, study, fitness and journal', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await register(page, account);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, account);
  });

  test('a habit can be created and checked in, building a streak', async ({ page }) => {
    await navigateTo(page, 'Habits', 'Habits');
    await expect(page.getByText('No habits yet')).toBeVisible();

    await page.getByRole('button', { name: 'Create your first habit' }).click();
    await dialogField(page, 'Name').fill('Morning reading');
    await dialogField(page, 'Description').fill('30 pages before anything else.');
    await dialog(page).getByRole('button', { name: 'Create habit' }).click();
    await expectToast(page, 'Habit created');

    await expect(page.getByText('Morning reading')).toBeVisible();
    await expect(page.getByText('0 day streak')).toBeVisible();

    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expectToast(page, 'Habit completed');

    await page.reload();
    await expect(page.getByText('1 day streak')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Checked in' })).toBeVisible();
  });

  test('a multi-count habit only completes once it reaches its target', async ({ page }) => {
    await navigateTo(page, 'Habits', 'Habits');

    await page.getByRole('button', { name: 'New habit' }).click();
    await dialogField(page, 'Name').fill('Drink water');
    await dialogField(page, 'Target per day').fill('3');
    await dialog(page).getByRole('button', { name: 'Create habit' }).click();
    await expectToast(page, 'Habit created');

    await page.reload();
    const card = page.locator('li', { hasText: 'Drink water' }).first();
    await expect(card.getByText('0/3 today')).toBeVisible();

    await card.getByRole('button', { name: 'Actions for Drink water' }).click();
    await page.getByRole('menuitem', { name: /Add one/ }).click();
    await expectToast(page, 'Progress saved');

    await page.reload();
    await expect(
      page.locator('li', { hasText: 'Drink water' }).first().getByText('1/3 today'),
    ).toBeVisible();
  });

  test('a study session can be logged and feeds the totals', async ({ page }) => {
    await navigateTo(page, 'Study', 'Study');
    await expect(page.getByText('No study sessions yet')).toBeVisible();

    await page.getByRole('button', { name: 'Log your first session' }).click();
    await dialogField(page, 'Subject').fill('Distributed Systems');
    await dialogField(page, 'Topic').fill('Raft consensus');
    await dialogField(page, 'Duration (minutes)').fill('90');
    await dialogField(page, 'Notes').fill('Worked through leader election.');
    await dialog(page).getByRole('button', { name: 'Log session' }).click();
    await expectToast(page, 'Study session logged');

    await page.reload();
    await expect(page.getByText('Distributed Systems').first()).toBeVisible();
    await expect(page.getByText('Raft consensus')).toBeVisible();
    // 90 minutes must render as 1h 30m in the today and all-time cards.
    await expect(page.getByText('1h 30m').first()).toBeVisible();
  });

  test('study validation rejects a non-positive duration', async ({ page }) => {
    await navigateTo(page, 'Study', 'Study');
    await page.getByRole('button', { name: 'Log session' }).click();
    await dialogField(page, 'Subject').fill('Maths');
    await dialogField(page, 'Duration (minutes)').fill('0');
    await dialog(page).getByRole('button', { name: 'Log session' }).click();
    await expect(page.getByText('Duration must be greater than zero.')).toBeVisible();
  });

  test('a study session can be edited and deleted', async ({ page }) => {
    await navigateTo(page, 'Study', 'Study');

    await page.getByRole('button', { name: 'Log session' }).click();
    await dialogField(page, 'Subject').fill('Temporary Subject');
    await dialogField(page, 'Duration (minutes)').fill('30');
    await dialog(page).getByRole('button', { name: 'Log session' }).click();
    await expectToast(page, 'Study session logged');

    await page.getByRole('button', { name: 'Edit Temporary Subject session' }).click();
    await dialogField(page, 'Duration (minutes)').fill('45');
    await dialog(page).getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Session updated');

    await page.getByRole('button', { name: 'Delete Temporary Subject session' }).click();
    await page.getByRole('button', { name: 'Delete session' }).click();
    await expectToast(page, 'Session deleted');
    await expect(page.getByText('Temporary Subject')).toHaveCount(0);
  });

  test('a workout with exercises can be logged', async ({ page }) => {
    await navigateTo(page, 'Fitness', 'Fitness');
    await expect(page.getByText('No workouts logged')).toBeVisible();

    await page.getByRole('button', { name: 'Log your first workout' }).click();
    await dialogField(page, 'Workout').fill('Upper body push');
    await dialogField(page, 'Duration (min)').fill('60');

    await dialogField(page, 'Exercise 1 name').fill('Bench press');
    await dialogField(page, 'Exercise 1 sets').fill('4');
    await dialogField(page, 'Exercise 1 reps').fill('8');
    await dialogField(page, 'Exercise 1 weight in kilograms').fill('60');

    await page.getByRole('button', { name: 'Add exercise' }).click();
    await dialogField(page, 'Exercise 2 name').fill('Overhead press');
    await dialogField(page, 'Exercise 2 sets').fill('3');
    await dialogField(page, 'Exercise 2 reps').fill('10');
    await dialogField(page, 'Exercise 2 weight in kilograms').fill('35');

    await dialog(page).getByRole('button', { name: 'Log workout' }).click();
    await expectToast(page, 'Workout logged');

    await page.reload();
    // Exact, because the exercise table's sr-only caption reads
    // "Exercises in Upper body push".
    await expect(page.getByText('Upper body push', { exact: true })).toBeVisible();
    await expect(page.getByText('2 exercises')).toBeVisible();

    // The two tables are addressed by their captions: the same exercise name
    // appears in the workout's own rows and in the all-time history, so an
    // unscoped cell lookup would be ambiguous.
    const workoutTable = page.getByRole('table', { name: 'Exercises in Upper body push' });
    await expect(workoutTable.getByRole('cell', { name: 'Bench press' })).toBeVisible();
    await expect(workoutTable.getByRole('cell', { name: '60 kg' })).toBeVisible();
    await expect(workoutTable.getByRole('cell', { name: 'Overhead press' })).toBeVisible();

    // The history table aggregates the stored exercise rows independently.
    const history = page.getByRole('table', { name: 'Exercises by frequency' });
    await expect(history.getByRole('cell', { name: 'Bench press' })).toBeVisible();
    await expect(history.getByRole('cell', { name: 'Overhead press' })).toBeVisible();
  });

  test('a journal entry can be created, searched and filtered by mood', async ({ page }) => {
    await navigateTo(page, 'Journal', 'Journal');
    await expect(page.getByText('No entries yet')).toBeVisible();

    await page.getByRole('button', { name: 'Write your first entry' }).click();
    await dialogField(page, 'Title').fill('A productive Tuesday');
    await page.getByRole('button', { name: /Great/ }).click();
    await dialogField(page, 'Entry').fill('Finally understood how Raft handles split votes.');
    await dialog(page).getByRole('button', { name: 'Save entry' }).click();
    await expectToast(page, 'Entry saved');

    await page.reload();
    await expect(page.getByText('A productive Tuesday')).toBeVisible();
    await expect(page.getByText('1 day streak').or(page.getByText('Current streak'))).toBeVisible();

    // Search hits the content, not just the title.
    await page.getByLabel('Search journal entries').fill('split votes');
    await expect(page.getByText('A productive Tuesday')).toBeVisible();

    await page.goto('/journal?search=nothing-matches-this');
    await expect(page.getByText('No entries match')).toBeVisible();

    // Mood filtering narrows to the right rows, driven by the chips themselves.
    await page.goto('/journal');
    const moods = page.getByRole('navigation', { name: 'Filter by mood' });

    await moods.getByRole('link', { name: /Great/ }).click();
    await expect(page).toHaveURL(/mood=GREAT/);
    await expect(page.getByText('A productive Tuesday')).toBeVisible();

    // A second chip click must also navigate: an earlier implementation
    // silently dropped it and left the previous filter applied.
    await moods.getByRole('link', { name: /Bad/ }).click();
    await expect(page).toHaveURL(/mood=BAD/);
    await expect(page.getByText('No entries match')).toBeVisible();
  });

  test('journal validation rejects empty content', async ({ page }) => {
    await navigateTo(page, 'Journal', 'Journal');
    await page.getByRole('button', { name: 'New entry' }).click();
    await dialog(page).getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByText('Write something before saving.')).toBeVisible();
  });

  test('a calendar event can be created and appears in the agenda', async ({ page }) => {
    await navigateTo(page, 'Calendar', 'Calendar');

    await page.getByRole('button', { name: 'New event' }).click();
    await dialogField(page, 'Title').fill('Algorithms lecture');
    const start = new Date();
    start.setDate(start.getDate() + 2);
    start.setHours(10, 0, 0, 0);
    const toLocal = (date: Date) =>
      new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await dialogField(page, 'Starts').fill(toLocal(start));
    const end = new Date(start.getTime() + 90 * 60_000);
    await dialogField(page, 'Ends').fill(toLocal(end));
    await dialogField(page, 'Location').fill('Hall C');
    await dialog(page).getByRole('button', { name: 'Create event' }).click();
    await expectToast(page, 'Event created');

    await page.reload();
    await page.getByRole('tab', { name: 'Agenda' }).click();
    await expect(page.getByText('Algorithms lecture').first()).toBeVisible();
    await expect(page.getByText('Hall C')).toBeVisible();
  });

  test('event validation rejects an end time before the start', async ({ page }) => {
    await navigateTo(page, 'Calendar', 'Calendar');
    await page.getByRole('button', { name: 'New event' }).click();
    await dialogField(page, 'Title').fill('Backwards event');
    await dialogField(page, 'Starts').fill('2026-06-01T12:00');
    await dialogField(page, 'Ends').fill('2026-06-01T10:00');
    await dialog(page).getByRole('button', { name: 'Create event' }).click();
    await expect(page.getByText('The end time cannot be before the start time.')).toBeVisible();
  });
});
