import { beforeEach, expect, it, vi } from 'vitest';

import HomePage from '@/app/page';

const loaders = vi.hoisted(() => ({
  user: vi.fn(),
  classes: vi.fn(),
  pages: vi.fn(),
  announcements: vi.fn(),
  timetable: vi.fn(),
  tasks: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({}),
}));
vi.mock('@/lib/content/dashboard', () => ({
  getCurrentUserSummary: loaders.user,
  listDashboardPages: loaders.pages,
}));
vi.mock('@/lib/content/classes', () => ({ listClassTags: loaders.classes }));
vi.mock('@/lib/content/announcements', () => ({
  listAnnouncements: loaders.announcements,
}));
vi.mock('@/lib/content/calendar', () => ({ listUpcoming: loaders.timetable }));
vi.mock('@/lib/content/assignments', () => ({
  listAssignments: loaders.tasks,
}));

const own = { id: 'maths', name: 'Y9MA1', displayName: 'Year 9 Maths' };
const foreign = {
  id: 'english',
  name: 'Y10EN1',
  displayName: 'Year 10 English',
};
const shared = { id: 'shared', title: 'Shared work', tags: [foreign, own] };
const broadcast = {
  id: 'broadcast',
  title: 'Assembly',
  isBroadcast: true,
  tags: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  loaders.user.mockResolvedValue({
    email: 'pupil@school.test',
    role: 'student',
  });
  loaders.classes.mockResolvedValue([own]);
  loaders.pages.mockResolvedValue([]);
  loaders.announcements.mockResolvedValue([shared, broadcast]);
  loaders.timetable.mockResolvedValue([shared, broadcast]);
  loaders.tasks.mockResolvedValue([shared]);
});

it.each(['student', 'teacher', 'admin'])(
  'keeps authorised work and broadcasts while projecting %s class labels',
  async (role) => {
    loaders.user.mockResolvedValue({ email: 'person@school.test', role });
    const { props } = await HomePage();
    const tags = role === 'admin' ? [foreign, own] : [own];
    expect(props.tasks).toEqual([{ ...shared, tags }]);
    expect(props.timetable).toEqual([{ ...shared, tags }, broadcast]);
    expect(props.updates[0].tags).toEqual(tags.map((tag) => tag.name));
    expect(props.updates[1].tags).toEqual([]);
    expect(loaders.pages).toHaveBeenCalledWith(
      {},
      role === 'admin' ? null : ['maths'],
    );
  },
);

it('keeps identity, tasks and timetable when class loading fails closed', async () => {
  loaders.classes.mockRejectedValue(new Error('Temporary membership outage'));
  const { props } = await HomePage();
  expect(props.currentUser).toEqual({
    email: 'pupil@school.test',
    role: 'student',
  });
  expect(props.classes).toBeNull();
  expect(loaders.pages).toHaveBeenCalledWith({}, []);
  expect(props.tasks).toEqual([{ ...shared, tags: [] }]);
  expect(props.timetable).toEqual([{ ...shared, tags: [] }, broadcast]);
});
