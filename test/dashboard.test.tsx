import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Dashboard, { type DashboardPage } from '@/components/Dashboard';

const SAMPLE_PAGES: DashboardPage[] = [
  {
    id: 'p1',
    title: 'Organic Mechanisms — Nucleophilic Substitution',
    canonicalUrl: '/chemistry/organic-chemistry/mechanisms',
    updatedAt: new Date().toISOString(),
    tags: [{ name: 'L6CH2', displayName: 'Lower Sixth Chemistry Set 2' }],
  },
  {
    id: 'p2',
    title: 'Trigonometry Revision Pack',
    canonicalUrl: '/maths/year-9/set-1/trigonometry',
    updatedAt: new Date().toISOString(),
    tags: [{ name: 'Y9MA1', displayName: 'Year 9 Maths Set 1' }],
  },
];

describe('Dashboard', () => {
  it('renders the primary navigation and tag feed', () => {
    render(<Dashboard pages={SAMPLE_PAGES} />);

    expect(screen.getByText('Project', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Y9MA1/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(
      screen.getByText('Organic Mechanisms — Nucleophilic Substitution'),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no authorized pages', () => {
    render(<Dashboard pages={[]} />);

    expect(screen.getByText('No pages yet')).toBeInTheDocument();
  });
});
