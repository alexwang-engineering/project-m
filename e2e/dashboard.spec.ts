import { expect, test } from '@playwright/test';

test('dashboard loads its primary controls', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('Project M', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Notifications' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
});
