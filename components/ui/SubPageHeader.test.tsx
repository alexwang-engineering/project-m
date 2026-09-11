import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SubPageHeader } from './SubPageHeader';

describe('SubPageHeader', () => {
  it('exposes the page title as its level-one heading', () => {
    render(<SubPageHeader title="Resources" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Resources' }),
    ).toBeInTheDocument();
  });
});
