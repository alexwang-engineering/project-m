import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StrictMode } from 'react';

import Dashboard, { type DashboardPage } from '@/components/Dashboard';
import type { AssignmentSummary } from '@/lib/content/assignments';

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

const SAMPLE_CLASSES = SAMPLE_PAGES.flatMap((page) => page.tags);

const TODAY_ISO = '2026-08-13T09:00:00.000Z';
const TODAY_LABEL = 'Thursday, 13 August';

const STUDENT_USER = {
  email: 's.student@merchanttaylors.com',
  role: 'student' as const,
};

function assignment(
  overrides: Partial<AssignmentSummary> &
    Pick<AssignmentSummary, 'id' | 'title'>,
): AssignmentSummary {
  return {
    dueAt: '2026-08-20T09:00:00.000Z',
    allowResubmission: false,
    tags: [{ name: 'Y9CS1', displayName: 'Year 9 Computing' }],
    hasSubmitted: false,
    instructions: null,
    lifecycle: 'published',
    availableFrom: null,
    closedAt: null,
    ...overrides,
  };
}

const SAMPLE_USER = {
  email: 'j.dale@merchanttaylors.com',
  role: 'teacher' as const,
};

describe('Dashboard', () => {
  it.each(['teacher', 'student'] as const)(
    'shows %s memberships even without lessons and excludes unrelated page tags',
    (role) => {
      render(
        <Dashboard
          todayLabel={TODAY_LABEL}
          todayIso={TODAY_ISO}
          pages={SAMPLE_PAGES}
          updates={[]}
          currentUser={{ ...SAMPLE_USER, role }}
          classes={[
            SAMPLE_CLASSES[1]!,
            { name: 'Y9FR1', displayName: 'Year 9 French Set 1' },
          ]}
        />,
      );
      const groups = within(
        screen.getByRole('region', { name: 'Your classes' }),
      );
      expect(groups.getByRole('button', { name: /Y9FR1/ })).toBeInTheDocument();
      expect(
        groups.queryByRole('button', { name: /L6CH2/ }),
      ).not.toBeInTheDocument();
      fireEvent.click(groups.getByRole('button', { name: /Y9FR1/ }));
      expect(
        screen.getByRole('heading', { name: 'Year 9 French Set 1 lessons' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No recent lessons for this class/),
      ).toBeInTheDocument();
    },
  );

  it('shows an unassigned account honestly instead of inventing classes from content', () => {
    render(
      <Dashboard
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={STUDENT_USER}
        classes={[]}
      />,
    );
    expect(
      screen.getByText('No classes are assigned to your account yet.'),
    ).toBeInTheDocument();
  });

  it('distinguishes unavailable classes from an unassigned account', () => {
    render(
      <Dashboard
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={STUDENT_USER}
        classes={null}
      />,
    );
    expect(
      screen.getByText(/Your classes could not be loaded/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No classes are assigned/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('filters lessons using the existing class tags', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={SAMPLE_PAGES}
        updates={[]}
        currentUser={SAMPLE_USER}
      />,
    );
    const maths = screen.getByRole('button', { name: /Y9MA1/ });
    fireEvent.click(maths);
    expect(maths).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(SAMPLE_PAGES[0]!.title)).not.toBeInTheDocument();
    expect(screen.getByText(SAMPLE_PAGES[1]!.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /All my classes/ }));
    expect(screen.getByText(SAMPLE_PAGES[0]!.title)).toBeInTheDocument();
  });

  it('keeps previews open through strict-mode cleanup and dismisses them', () => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value() {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value() {
          this.open = false;
        },
      },
    });
    try {
      render(
        <StrictMode>
          <Dashboard
            classes={SAMPLE_CLASSES}
            todayLabel={TODAY_LABEL}
            todayIso={TODAY_ISO}
            pages={SAMPLE_PAGES}
            updates={[]}
            currentUser={SAMPLE_USER}
          />
        </StrictMode>,
      );
      fireEvent.click(screen.getByRole('link', { name: /Organic Mechanisms/ }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('open');
      fireEvent(dialog, new Event('close'));
      expect(
        screen.getByRole('button', { name: 'Close page preview' }),
      ).toHaveFocus();
      fireEvent.click(
        screen.getByRole('button', { name: 'Close page preview' }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    }
  });

  it('keeps lessons available when the optional calendar cannot load', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={SAMPLE_PAGES}
        updates={[]}
        timetable={null}
        currentUser={SAMPLE_USER}
      />,
    );
    expect(screen.getByText(SAMPLE_PAGES[0]!.title)).toBeInTheDocument();
    expect(
      screen.getByText(/calendar is temporarily unavailable/),
    ).toBeInTheDocument();
  });

  it('renders the primary navigation and tag feed', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={SAMPLE_PAGES}
        updates={[]}
        currentUser={SAMPLE_USER}
      />,
    );

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
    expect(
      screen.getByRole('link', {
        name: /Organic Mechanisms — Nucleophilic Substitution/,
      }),
    ).toHaveAttribute('href', '/chemistry/organic-chemistry/mechanisms');
    expect(
      screen.queryByRole('link', { name: 'Admin' }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no authorized pages', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={SAMPLE_USER}
      />,
    );

    expect(screen.getByText('No lessons yet')).toBeInTheDocument();
  });

  it('keeps unpublished and not-yet-open work out of a student’s task list', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={STUDENT_USER}
        tasks={[
          assignment({ id: 'a1', title: 'Published and open' }),
          assignment({ id: 'a2', title: 'Still a draft', lifecycle: 'draft' }),
          assignment({
            id: 'a3',
            title: 'Opens next week',
            availableFrom: '2026-08-20T09:00:00.000Z',
          }),
          assignment({
            id: 'a4',
            title: 'Submissions already closed',
            closedAt: '2026-08-12T09:00:00.000Z',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Published and open')).toBeInTheDocument();
    // RLS lets a tag member read both of these; the overview must not present
    // them as work that is due.
    expect(screen.queryByText('Still a draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Opens next week')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Submissions already closed'),
    ).not.toBeInTheDocument();
    // The pill renders count and label as sibling spans.
    const tasksDuePill = screen
      .getByText('Tasks due')
      .closest('span')?.parentElement;
    expect(
      within(tasksDuePill as HTMLElement).getByText('1'),
    ).toBeInTheDocument();
  });

  it('shows the real signed-in identity, not a hardcoded placeholder', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={SAMPLE_USER}
      />,
    );

    // The identity now sits behind the account chip, so assert the accessible
    // name on the trigger and the details it reveals once opened.
    const account = screen.getByRole('button', { name: 'Account for J Dale' });
    expect(account).toBeInTheDocument();
    expect(screen.queryByText('Jonathan Dale')).not.toBeInTheDocument();

    fireEvent.click(account);
    expect(screen.getByText('J Dale')).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_USER.email)).toBeInTheDocument();
  });

  it('renders a generic guest state when signed out', () => {
    const { container } = render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={null}
      />,
    );
    const view = within(container);

    expect(view.getByText('Welcome to Project M')).toBeInTheDocument();
    expect(
      view.getByRole('link', { name: 'Sign in with Microsoft' }),
    ).toHaveAttribute('href', '/auth/login');
    expect(
      view.queryByText('student', { exact: false }),
    ).not.toBeInTheDocument();
    expect(
      view.queryByRole('button', { name: 'Create' }),
    ).not.toBeInTheDocument();
    expect(view.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows administrative navigation only to administrators', () => {
    render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[]}
        currentUser={{ ...SAMPLE_USER, role: 'admin' }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin',
    );
  });

  it('shows real tag-scoped announcements in notifications', async () => {
    const { container } = render(
      <Dashboard
        classes={SAMPLE_CLASSES}
        todayLabel={TODAY_LABEL}
        todayIso={TODAY_ISO}
        pages={[]}
        updates={[
          {
            id: 'a1',
            title: 'Bring your calculator',
            createdAt: new Date().toISOString(),
            tags: ['Y9MA1'],
          },
        ]}
        currentUser={SAMPLE_USER}
      />,
    );
    const view = within(container);

    fireEvent.click(view.getByRole('button', { name: 'Notifications' }));
    expect(
      await within(
        view.getByRole('region', { name: 'Class updates' }),
      ).findByRole('link', { name: /Bring your calculator/ }),
    ).toHaveAttribute('href', '/announcements');
  });
});
