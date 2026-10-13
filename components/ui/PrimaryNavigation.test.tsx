import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PrimaryNavigation } from './PrimaryNavigation';
vi.mock('next/navigation', () => ({
  usePathname: () => '/assignments/example',
}));
it('marks the current section and preserves links to other learning areas', () => {
  render(<PrimaryNavigation />);
  const nav = within(screen.getByRole('navigation', { name: 'Primary' }));
  expect(nav.getByRole('link', { name: 'Assignments' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
    'aria-current',
  );
  expect(nav.getByRole('link', { name: 'Resources' })).toHaveAttribute(
    'href',
    '/resources',
  );
});
