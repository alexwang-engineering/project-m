import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Dashboard from '@/components/Dashboard';

describe('Dashboard', () => {
  it('renders the primary navigation and tag feed', () => {
    render(<Dashboard />);

    expect(screen.getByText('Project', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Y9MA18' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
