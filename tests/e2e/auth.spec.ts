import { expect, test } from '@playwright/test';

import { formAlert, login, newAccount, register, signOut } from './fixtures';

/**
 * Each test registers its own account.
 *
 * Sharing one account across tests couples them: a failure in the test that
 * creates it leaves every later test signing in as a user that was never
 * created, which hides the original cause behind a cascade of "User not found".
 */
test.describe('authentication', () => {
  test('landing page offers sign-up and sign-in to anonymous visitors', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/control centre/i);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();
  });

  test('protected routes redirect anonymous visitors to the login page', async ({ page }) => {
    for (const route of ['/dashboard', '/tasks', '/projects', '/analytics', '/settings']) {
      await page.goto(route);
      await expect(page, `${route} should redirect`).toHaveURL(/\/login$/);
    }
  });

  test('a new user can register and reaches their dashboard', async ({ page }) => {
    const account = newAccount('register');
    await register(page, account);

    // The dashboard greeting is built from the account's first name.
    const firstName = account.name.split(' ')[0]!;
    await expect(page.getByRole('heading', { level: 1 })).toContainText(firstName);
  });

  test('registration rejects a mismatched password confirmation', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Name').fill('Mismatch Tester');
    await page.getByLabel('Email').fill(newAccount('mismatch').email);
    await page.getByLabel('Password', { exact: true }).fill('password-one');
    await page.getByLabel('Confirm password').fill('password-two');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Passwords do not match.')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('registration rejects a duplicate email', async ({ page }) => {
    const account = newAccount('duplicate');
    await register(page, account);
    await signOut(page);

    await page.goto('/register');
    await page.getByLabel('Name').fill('Duplicate Tester');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill('a-different-password');
    await page.getByLabel('Confirm password').fill('a-different-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(formAlert(page)).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('login rejects a wrong password without revealing which field failed', async ({ page }) => {
    const account = newAccount('wrongpass');
    await register(page, account);
    await signOut(page);

    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(formAlert(page)).toContainText(
      'That email and password combination did not match an account.',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login rejects an unknown email with the same generic message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(newAccount('ghost').email);
    await page.getByLabel('Password', { exact: true }).fill('some-password-1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Identical copy to the wrong-password case, so the form cannot be used to
    // discover which email addresses are registered.
    await expect(formAlert(page)).toContainText(
      'That email and password combination did not match an account.',
    );
  });

  test('a registered user can sign out and sign back in', async ({ page }) => {
    const account = newAccount('session');
    await register(page, account);
    await signOut(page);

    // The session is gone, so the dashboard bounces back to login.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);

    await login(page, account);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('signed-in users are redirected away from the auth pages', async ({ page }) => {
    await register(page, newAccount('redirect'));

    for (const route of ['/login', '/register', '/']) {
      await page.goto(route);
      await expect(page, `${route} should redirect to the dashboard`).toHaveURL(/\/dashboard$/);
    }
  });
});
