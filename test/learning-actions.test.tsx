import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import AssignmentsView from '@/components/assignments/AssignmentsView';
import QuizzesView from '@/components/quizzes/QuizzesView';
import { CalendarView } from '@/components/calendar/CalendarView';
import { AnnouncementsView } from '@/components/announcements/AnnouncementsView';
import SubmissionsView from '@/components/assignments/SubmissionsView';

const submission = {
  id: '00000000-0000-4000-8000-000000000010',
  submittedAt: '2026-08-08T12:00:00Z',
  note: null,
  studentEmail: 'student@merchanttaylors.com',
  fileId: '00000000-0000-4000-8000-000000000011',
  grade: 85,
  gradeFeedback: 'Good structure',
  gradeReleasedAt: '2026-08-08T13:00:00Z',
};

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

  it('keeps student calendar and announcements read-only', () => {
    render(
      <CalendarView
        items={[]}
        writableTags={[]}
        currentUserId="00000000-0000-4000-8000-000000000001"
        isAdmin={false}
      />,
    );
    expect(screen.queryByText('Create an event')).not.toBeInTheDocument();

    render(
      <AnnouncementsView
        announcements={[]}
        writableTags={[]}
        currentUserId="00000000-0000-4000-8000-000000000001"
        isAdmin={false}
      />,
    );
    expect(screen.queryByText('Post an announcement')).not.toBeInTheDocument();
  });

  it('shows released marks to students without exposing teacher controls', () => {
    const { container } = render(
      <SubmissionsView
        assignment={{
          id: '00000000-0000-4000-8000-000000000012',
          title: 'Lab report',
          dueAt: null,
          canManage: false,
          lifecycle: 'published',
          version: 1,
          availableFrom: null,
          closedAt: null,
          instructions: null,
          submissions: [submission],
        }}
      />,
    );
    const view = within(container);
    expect(view.getByText(/Mark: 85\/100/)).toBeInTheDocument();
    expect(view.queryByLabelText('Grade out of 100')).not.toBeInTheDocument();
    expect(
      view.queryByRole('button', { name: 'Release' }),
    ).not.toBeInTheDocument();
  });

  it('embeds canonical instructions in the student task view', () => {
    render(
      <SubmissionsView
        assignment={{
          id: '00000000-0000-4000-8000-000000000012',
          title: 'Lab report',
          dueAt: null,
          canManage: false,
          lifecycle: 'published',
          version: 1,
          availableFrom: null,
          closedAt: null,
          instructions: {
            id: '00000000-0000-4000-8000-000000000013',
            title: 'Lab instructions',
            canonicalUrl: '/science/lab-instructions',
            content: {
              schemaVersion: 1,
              blocks: [
                {
                  id: '00000000-0000-4000-8000-000000000014',
                  type: 'paragraph',
                  html: 'Record your observations.',
                },
              ],
            },
          },
          submissions: [],
        }}
      />,
    );
    expect(screen.getByText('Record your observations.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your submission' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/you don't manage/i)).not.toBeInTheDocument();
  });

  it('keeps save and release as separate teacher actions', () => {
    const { container } = render(
      <SubmissionsView
        assignment={{
          id: '00000000-0000-4000-8000-000000000012',
          title: 'Lab report',
          dueAt: null,
          canManage: true,
          lifecycle: 'published',
          version: 1,
          availableFrom: null,
          closedAt: null,
          instructions: null,
          submissions: [{ ...submission, gradeReleasedAt: null }],
        }}
      />,
    );
    const view = within(container);
    expect(view.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Release' })).toBeEnabled();
  });

  it('opens an inline form for pupil-specific extensions', async () => {
    const user = userEvent.setup();
    render(
      <SubmissionsView
        assignment={{
          id: '00000000-0000-4000-8000-000000000012',
          title: 'Lab report',
          dueAt: null,
          canManage: true,
          lifecycle: 'published',
          version: 1,
          availableFrom: null,
          closedAt: null,
          instructions: null,
          submissions: [],
          roster: [
            {
              studentId: '00000000-0000-4000-8000-000000000015',
              studentEmail: 'student@merchanttaylors.com',
              submissionId: null,
              status: 'not_submitted',
              effectiveDueAt: null,
              withdrawnAt: null,
            },
          ],
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Extend' }));
    expect(screen.getByLabelText('Extended due date')).toBeInTheDocument();
    expect(screen.getByLabelText('Exception reason')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save extension' }),
    ).toBeDisabled();
  });
});
