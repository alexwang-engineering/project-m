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

const SAMPLE_USER = {
  email: 'j.dale@merchanttaylors.com',
  role: 'teacher' as const,
};

describe('Dashboard', () => {
  it('renders the primary navigation and tag feed', () => {
    render(<Dashboard pages={SAMPLE_PAGES} currentUser={SAMPLE_USER} />);

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
    render(<Dashboard pages={[]} currentUser={SAMPLE_USER} />);

    expect(screen.getByText('No pages yet')).toBeInTheDocument();
  });

  it('shows the real signed-in identity, not a hardcoded placeholder', () => {
    render(<Dashboard pages={[]} currentUser={SAMPLE_USER} />);

    expect(screen.getAllByText('J Dale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('teacher').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jonathan Dale')).not.toBeInTheDocument();
  });

  it('renders a generic guest state when signed out', () => {
    render(<Dashboard pages={[]} currentUser={null} />);

    expect(screen.getByText('Signed out')).toBeInTheDocument();
  });
});
