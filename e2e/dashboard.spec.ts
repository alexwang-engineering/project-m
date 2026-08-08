import { expect, test } from '@playwright/test';

test('dashboard loads its primary controls', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('Project M', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Notifications' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('No new tag updates.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
});
