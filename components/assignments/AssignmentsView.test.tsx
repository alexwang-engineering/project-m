import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AssignmentsView from './AssignmentsView';
import type { AssignmentSummary } from '@/lib/content/assignments';

const assignment: AssignmentSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Algebra homework',
  dueAt: null,
  availableFrom: null,
  closedAt: null,
  lifecycle: 'published',
  hasSubmitted: false,
  allowResubmission: false,
  tags: [{ name: 'Y9MA1', displayName: 'Year 9 Mathematics' }],
  instructions: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('assignment submission availability', () => {
  it('updates at opening and expiry while preserving a selected file', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));
    render(
      <AssignmentsView
        canCreate={false}
        assignments={[
          {
            ...assignment,
            availableFrom: '2026-09-11T12:00:01Z',
            dueAt: '2026-09-11T12:00:02Z',
          },
        ]}
      />,
    );
    expect(
      screen.queryByLabelText(`Choose a file for ${assignment.title}`),
    ).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const input = screen.getByLabelText(
      `Choose a file for ${assignment.title}`,
    );
    expect(input).toBeEnabled();
    fireEvent.change(input, {
      target: {
        files: [new File(['work'], 'maths.pdf', { type: 'application/pdf' })],
      },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    expect(screen.getByText('maths.pdf')).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(
      screen.getByText('The submission deadline has passed.'),
    ).toBeInTheDocument();
  });

  it.each<{
    name: string;
    change: Partial<AssignmentSummary>;
    canSubmit: boolean;
    message?: string;
  }>([
    { name: 'no deadline', change: {}, canSubmit: true },
    {
      name: 'effective extended deadline',
      change: { dueAt: '2026-09-12T12:00:00Z' },
      canSubmit: true,
    },
    {
      name: 'at the deadline',
      change: { dueAt: '2026-09-11T12:00:00Z' },
      canSubmit: true,
    },
    {
      name: 'at the opening time',
      change: { availableFrom: '2026-09-11T12:00:00Z' },
      canSubmit: true,
    },
    {
      name: 'expired',
      change: { dueAt: '2026-09-10T12:00:00Z' },
      canSubmit: false,
      message: 'The submission deadline has passed.',
    },
    {
      name: 'not open yet',
      change: { availableFrom: '2026-09-12T12:00:00Z' },
      canSubmit: false,
      message: 'This assignment is not open yet.',
    },
    {
      name: 'closed',
      change: { closedAt: '2026-09-10T12:00:00Z' },
      canSubmit: false,
      message: 'Submissions are closed.',
    },
    {
      name: 'draft',
      change: { lifecycle: 'draft' },
      canSubmit: false,
      message: 'This assignment is not published.',
    },
    {
      name: 'archived',
      change: { lifecycle: 'archived' },
      canSubmit: false,
      message: 'This assignment is not published.',
    },
    {
      name: 'submitted once',
      change: { hasSubmitted: true },
      canSubmit: false,
      message: 'Submitted',
    },
    {
      name: 'resubmission allowed',
      change: { hasSubmitted: true, allowResubmission: true },
      canSubmit: true,
      message: 'Submitted',
    },
    {
      name: 'expired resubmission',
      change: {
        hasSubmitted: true,
        allowResubmission: true,
        dueAt: '2026-09-10T12:00:00Z',
      },
      canSubmit: false,
      message: 'Submitted',
    },
  ])('$name', ({ change, canSubmit, message }) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-11T12:00:00Z'));
    render(
      <AssignmentsView
        assignments={[{ ...assignment, ...change }]}
        canCreate={false}
      />,
    );

    const input = screen.queryByLabelText(
      `Choose a file for ${assignment.title}`,
    );
    if (canSubmit) expect(input).toBeEnabled();
    else expect(input).not.toBeInTheDocument();
    if (message) expect(screen.getByText(message)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View assignment & feedback' }),
    ).toHaveAttribute('href', `/assignments/${assignment.id}`);
  });

  it('keeps the file input in keyboard order and exposes the selected file', async () => {
    const user = userEvent.setup();
    render(<AssignmentsView assignments={[assignment]} canCreate={false} />);
    const note = screen.getByRole('textbox', {
      name: `Submission note for ${assignment.title}`,
    });
    const input = screen.getByLabelText(
      `Choose a file for ${assignment.title}`,
    );

    note.focus();
    await user.tab();
    expect(input).toHaveFocus();
    expect(input).not.toHaveClass('hidden');
    await user.upload(
      input,
      new File(['homework'], 'algebra.pdf', { type: 'application/pdf' }),
    );
    expect(screen.getByText('algebra.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });
});
