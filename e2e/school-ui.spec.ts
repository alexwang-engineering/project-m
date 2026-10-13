import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const role of ['student', 'teacher'] as const) {
  test(`${role} school dashboard preserves learning journeys`, async ({
    page,
  }) => {
    await page.goto('/demo');
    const entry = page.getByRole('button', { name: new RegExp(`^${role} `) });
    test.skip(
      !(await entry.isVisible()),
      'Requires the configured synthetic demo accounts.',
    );
    await entry.click();
    await expect(
      page.getByRole('heading', {
        name: role === 'student' ? 'Dashboard' : 'Your teaching workspace',
      }),
    ).toBeVisible();
    await page.waitForLoadState('load');
    await expect(
      page.getByRole('button', { name: 'Create', exact: true }),
    ).toHaveCount(role === 'teacher' ? 1 : 0);
    const classes = page.getByRole('region', {
      name: 'Your classes',
      exact: true,
    });
    await expect(classes.getByRole('button')).toHaveCount(
      role === 'teacher' ? 4 : 10,
    );
    for (const code of ['Y9MA1', 'Y9PH1', 'Y9CS1']) {
      await expect(
        classes.getByRole('button', { name: new RegExp(code) }),
      ).toBeVisible();
    }
    await expect(classes.getByRole('button', { name: /Y9EN1/ })).toHaveCount(
      role === 'teacher' ? 0 : 1,
    );
    const subject = classes.getByRole('button', { pressed: false }).first();
    await subject.click();
    await expect(classes.getByRole('button', { pressed: true })).not.toHaveText(
      /All my classes/,
    );
    await classes.getByRole('button', { name: /^All my classes/ }).click();
    const lesson = page
      .getByRole('region', { name: 'Your lessons', exact: true })
      .getByRole('link')
      .filter({ hasText: 'View lesson' })
      .first();
    await lesson.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Close page preview' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(lesson).toBeFocused();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
    await page.getByRole('link', { name: 'Assignments', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Assignments', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'New assignment', exact: true }),
    ).toHaveCount(role === 'teacher' ? 1 : 0);
    const assignments = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(assignments.violations).toEqual([]);
    await page.getByRole('link', { name: 'Resources', exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name:
          role === 'student'
            ? 'Your learning library'
            : 'Your teaching library',
        exact: true,
      }),
    ).toBeVisible();
    const classFilter = page.getByRole('combobox', { name: 'Filter by class' });
    await expect(classFilter.getByRole('option')).toHaveCount(
      role === 'teacher' ? 4 : 10,
    );
    await expect(
      classFilter.getByRole('option', { name: /Y9EN1/ }),
    ).toHaveCount(role === 'teacher' ? 0 : 1);
    if (role === 'teacher') {
      await expect(page.getByRole('table')).not.toContainText(
        /Y9(?:EN|HI|GE|CH|BI|FR)1/,
      );
    }
    const search = page.getByRole('searchbox', {
      name: 'Search resources',
      exact: true,
    });
    await search.fill('no-matching-school-resource');
    await expect(page.getByRole('status')).toHaveText('0 resources');
    await search.fill('');
    await expect(page.getByRole('status')).not.toHaveText('0 resources');
    const resources = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(resources.violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  });
}
