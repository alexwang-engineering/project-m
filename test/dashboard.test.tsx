import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StrictMode } from 'react';

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
  it('keeps previews open after strict-mode setup and closes them on dismissal', () => {
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
            pages={SAMPLE_PAGES}
            updates={[]}
            currentUser={SAMPLE_USER}
          />
        </StrictMode>,
      );
      fireEvent.click(screen.getByRole('link', { name: /Organic Mechanisms/ }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('open');
      // A queued close event from Strict Mode cleanup must not dismiss a reopened dialog.
      fireEvent(dialog, new Event('close'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
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

  it('filters authorized pages and announces the selected tag', () => {
    render(
      <Dashboard pages={SAMPLE_PAGES} updates={[]} currentUser={SAMPLE_USER} />,
    );
    const tag = screen.getByRole('button', { name: /Y9MA1/ });
    fireEvent.click(tag);
    expect(tag).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(SAMPLE_PAGES[0]!.title)).not.toBeInTheDocument();
    expect(screen.getByText(SAMPLE_PAGES[1]!.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /All pages/ }));
    expect(screen.getByText(SAMPLE_PAGES[0]!.title)).toBeInTheDocument();
  });

  it('renders the primary navigation and tag feed', () => {
    render(
      <Dashboard pages={SAMPLE_PAGES} updates={[]} currentUser={SAMPLE_USER} />,
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
    render(<Dashboard pages={[]} updates={[]} currentUser={SAMPLE_USER} />);

    expect(screen.getByText('No pages yet')).toBeInTheDocument();
  });

  it('shows the real signed-in identity, not a hardcoded placeholder', () => {
    render(<Dashboard pages={[]} updates={[]} currentUser={SAMPLE_USER} />);

    expect(screen.getAllByText('J Dale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('teacher').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jonathan Dale')).not.toBeInTheDocument();
  });

  it('renders a generic guest state when signed out', () => {
    const { container } = render(
      <Dashboard pages={[]} updates={[]} currentUser={null} />,
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
      await view.findByRole('link', { name: /Bring your calculator/ }),
    ).toHaveAttribute('href', '/announcements');
  });
});
