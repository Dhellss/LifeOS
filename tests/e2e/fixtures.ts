import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared E2E helpers.
 *
 * Every spec registers a fresh account, so specs never contend over the same
 * rows and the suite can run against a database that already holds data.
 */

export interface TestAccount {
  name: string;
  email: string;
  password: string;
}

export function newAccount(label: string): TestAccount {
  return {
    name: `E2E ${label}`,
    email: `e2e-${label}-${randomUUID().slice(0, 8)}@example.test`,
    password: 'e2e-password-1234',
  };
}

/** Register through the real signup form and land on the dashboard. */
export async function register(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Name').fill(account.name);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password').fill(account.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

/** Sign in through the real login form. */
export async function login(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.getByRole('button', { name: /Sign out of this device/ }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
}

/** Open the sidebar link for a module and wait for its heading. */
export async function navigateTo(page: Page, label: string, heading: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: label })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

/**
 * The open modal dialog.
 *
 * Dialog interactions are scoped to it for two reasons: several pages label
 * their header action the same as the dialog's submit button ("Log session"
 * both opens and saves), and the page behind the dialog carries `aria-label`s
 * of its own that a page-wide lookup would also match.
 */
export function dialog(page: Page): Locator {
  return page.getByRole('dialog');
}

/**
 * A labelled control inside the open dialog.
 *
 * Scoped and exact, because `getByLabel` matches substrings by default: an
 * unscoped `getByLabel('Priority')` also hits the task filter bar's
 * "Filter by priority" select, and `getByLabel('Subject')` hits the study
 * page's "Subject breakdown" chart region.
 */
export function dialogField(page: Page, label: string): Locator {
  return dialog(page).getByLabel(label, { exact: true });
}

/**
 * Choose a value from one of the Radix selects.
 *
 * Pass `scope` for a select inside a dialog. The options themselves are always
 * looked up on the page, because Radix portals the listbox to the document
 * body rather than nesting it in the dialog.
 */
export async function chooseOption(
  page: Page,
  selectLabel: string,
  optionName: string,
  scope?: Locator,
): Promise<void> {
  await (scope ?? page).getByLabel(selectLabel, { exact: true }).click();
  await page.getByRole('listbox').getByRole('option', { name: optionName }).click();
}

/**
 * The form-level error banner.
 *
 * Scoped to the `<form>` because Next.js renders its own
 * `#__next-route-announcer__` with `role="alert"` in the body, which would make
 * a bare `getByRole('alert')` ambiguous in every test.
 */
export function formAlert(page: Page) {
  return page.locator('form').getByRole('alert');
}

/** Wait for the toast confirming a mutation succeeded. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible({
    timeout: 15_000,
  });
}
