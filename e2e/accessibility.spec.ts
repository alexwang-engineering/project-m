import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Only pages reachable without a real Supabase/Entra session - everything
// authenticated needs a working local Postgres, which this environment's
// Colima VM cannot reach (see ADR-018).
const PAGES = ['/', '/auth/error?code=configuration', '/parent/login'];

for (const path of PAGES) {
  test(`${path} has no automatically detectable accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
}
