import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AssignmentsView from '@/components/assignments/AssignmentsView';
import QuizzesView from '@/components/quizzes/QuizzesView';

describe('role-sensitive learning actions', () => {
  it('hides authoring actions from students', () => {
    render(<AssignmentsView assignments={[]} canCreate={false} />);
    expect(
      screen.queryByRole('link', { name: 'New assignment' }),
    ).not.toBeInTheDocument();

    render(<QuizzesView quizzes={[]} canCreate={false} />);
    expect(
      screen.queryByRole('link', { name: 'New quiz' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Question bank' }),
    ).not.toBeInTheDocument();
  });

  it('shows authoring actions to teachers', () => {
    render(<AssignmentsView assignments={[]} canCreate />);
    expect(
      screen.getByRole('link', { name: 'New assignment' }),
    ).toHaveAttribute('href', '/assignments/new');

    render(<QuizzesView quizzes={[]} canCreate />);
    expect(screen.getByRole('link', { name: 'New quiz' })).toHaveAttribute(
      'href',
      '/quizzes/new',
    );
  });
});
