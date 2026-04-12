import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDashboardActivityFeed } from '@/utils/dashboard-activity';
import type { ActionItem } from '@/hooks/useActionsData';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';
import type { HorizonFile } from '@/hooks/useHorizonsRelationships';

const buildAction = (overrides: Partial<ActionItem> = {}): ActionItem => ({
  id: '/space/Projects/Alpha/Actions/default.md',
  name: 'Default Action',
  path: '/space/Projects/Alpha/Actions/default.md',
  projectName: 'Alpha',
  projectPath: '/space/Projects/Alpha',
  status: 'todo',
  createdDate: '2026-03-29T09:00:00.000Z',
  modifiedDate: '2026-03-29T09:00:00.000Z',
  ...overrides,
});

const buildProject = (overrides: Partial<ProjectWithMetadata> = {}): ProjectWithMetadata => ({
  id: '/space/Projects/Alpha',
  name: 'Alpha',
  path: '/space/Projects/Alpha',
  status: 'in-progress',
  description: 'Alpha project',
  createdDateTime: '2026-03-28T09:00:00.000Z',
  modifiedDate: '2026-03-28T09:00:00.000Z',
  ...overrides,
} as ProjectWithMetadata);

const buildHabit = (overrides: Partial<HabitWithHistory> = {}): HabitWithHistory => ({
  name: 'Stretch',
  frequency: 'daily',
  status: 'todo',
  path: '/space/Habits/stretch.md',
  createdDateTime: '2026-03-27T09:00:00.000Z',
  last_updated: '2026-03-27T09:00:00.000Z',
  history: [],
  periodHistory: [],
  currentStreak: 0,
  bestStreak: 0,
  averageStreak: 0,
  successRate: 0,
  totalCompletions: 0,
  totalAttempts: 0,
  recentTrend: 'stable',
  linkedProjects: [],
  linkedAreas: [],
  linkedGoals: [],
  linkedVision: [],
  linkedPurpose: [],
  ...overrides,
});

const buildHorizon = (overrides: Partial<HorizonFile> = {}): HorizonFile => ({
  id: '/space/Goals/Quarter.md',
  name: 'Quarter.md',
  path: '/space/Goals/Quarter.md',
  size: 0,
  last_modified: Math.floor(Date.parse('2026-03-26T09:00:00.000Z') / 1000),
  extension: 'md',
  horizonLevel: 'Goals',
  linkedTo: [],
  linkedFrom: [],
  createdDateTime: '2026-03-26T09:00:00.000Z',
  ...overrides,
});

describe('buildDashboardActivityFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('classifies and sorts action, project, habit, and horizon activity by latest event', () => {
    const feed = buildDashboardActivityFeed({
      actions: [
        buildAction({
          name: 'Ship lesson',
          status: 'completed',
          modifiedDate: '2026-03-31T11:00:00.000Z',
        }),
      ],
      projects: [
        buildProject({
          name: 'Beta',
          modifiedDate: '2026-03-30T11:00:00.000Z',
        }),
      ],
      habits: [
        buildHabit({
          name: 'Walk',
          periodHistory: [{ date: '2026-03-29', time: '09:15', completed: true }],
        }),
      ],
      horizonFiles: [
        buildHorizon({
          name: 'North Star.md',
          path: '/space/Vision/North Star.md',
          horizonLevel: 'Vision',
          createdDateTime: '2026-03-28T10:00:00.000Z',
          last_modified: Math.floor(Date.parse('2026-03-28T10:00:00.000Z') / 1000),
        }),
      ],
    });

    expect(feed).toHaveLength(4);
    expect(feed.map((item) => item.title)).toEqual(['Ship lesson', 'Beta', 'Walk', 'North Star']);
    expect(feed.map((item) => item.activityType)).toEqual(['completed', 'updated', 'completed', 'created']);
  });

  it('skips invalid or stale timestamps, excludes project horizon files, and caps the feed at ten rows', () => {
    const manyActions = Array.from({ length: 12 }, (_, index) =>
      buildAction({
        id: `/space/Projects/Alpha/Actions/${index}.md`,
        path: `/space/Projects/Alpha/Actions/${index}.md`,
        name: `Action ${index}`,
        createdDate: `2026-03-${String(20 + index).padStart(2, '0')}T09:00:00.000Z`,
        modifiedDate: `2026-03-${String(20 + index).padStart(2, '0')}T10:00:00.000Z`,
      })
    );

    const feed = buildDashboardActivityFeed({
      actions: [
        ...manyActions,
        buildAction({
          id: 'invalid',
          path: 'invalid',
          name: 'Broken timestamp',
          createdDate: 'not-a-date',
          modifiedDate: 'still-not-a-date',
        }),
        buildAction({
          id: 'stale',
          path: 'stale',
          name: 'Too old',
          createdDate: '2026-01-01T09:00:00.000Z',
          modifiedDate: '2026-01-01T09:00:00.000Z',
        }),
      ],
      projects: [],
      habits: [],
      horizonFiles: [
        buildHorizon({
          id: '/space/Projects/Alpha/README.md',
          path: '/space/Projects/Alpha/README.md',
          name: 'README.md',
          horizonLevel: 'Projects',
        }),
      ],
    });

    expect(feed).toHaveLength(10);
    expect(feed.some((item) => item.title === 'Broken timestamp')).toBe(false);
    expect(feed.some((item) => item.title === 'Too old')).toBe(false);
    expect(feed.some((item) => item.path === '/space/Projects/Alpha/README.md')).toBe(false);
    expect(feed[0]?.title).toBe('Action 11');
    expect(feed[9]?.title).toBe('Action 2');
  });
});
