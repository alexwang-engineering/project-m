import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PrimaryNavigation } from './PrimaryNavigation';
vi.mock('next/navigation', () => ({
  usePathname: () => '/assignments/example',
}));
it('marks the parent section as current on detail pages', () => {
  render(<PrimaryNavigation />);
  const nav = within(screen.getByRole('navigation', { name: 'Primary' }));
  expect(nav.getByRole('link', { name: 'Assignments' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(nav.getByRole('link', { name: 'Resources' })).not.toHaveAttribute(
    'aria-current',
  );
});
