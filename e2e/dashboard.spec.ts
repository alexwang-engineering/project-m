import { expect, test } from '@playwright/test';

test('signed-out dashboard offers school sign-in', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('Project M', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sign in with Microsoft' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Create' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
});
