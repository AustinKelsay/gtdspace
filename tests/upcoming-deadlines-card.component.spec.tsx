// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import UpcomingDeadlinesCard from '@/components/dashboard/UpcomingDeadlinesCard';
import type { ActionItem } from '@/hooks/useActionsData';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';

const buildProject = (overrides: Partial<ProjectWithMetadata> = {}): ProjectWithMetadata => ({
  id: '/space/Projects/Alpha',
  name: 'Launch Alpha',
  path: '/space/Projects/Alpha',
  status: 'in-progress',
  completionPercentage: 65,
  dueDate: '2026-04-04',
  createdDateTime: '2026-03-01T09:00:00.000Z',
  ...overrides,
} as ProjectWithMetadata);

const buildAction = (overrides: Partial<ActionItem> = {}): ActionItem => ({
  id: '/space/Projects/Alpha/Actions/release.md',
  name: 'Release lesson 6',
  path: '/space/Projects/Alpha/Actions/release.md',
  projectName: 'Alpha',
  projectPath: '/space/Projects/Alpha',
  status: 'todo',
  dueDate: '2026-04-05',
  ...overrides,
});

describe('UpcomingDeadlinesCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the refactored toolbar, project progress, and click handlers', () => {
    const onSelectProject = vi.fn();
    const onSelectAction = vi.fn();

    render(
      <UpcomingDeadlinesCard
        projects={[buildProject()]}
        actions={[buildAction()]}
        onSelectProject={onSelectProject}
        onSelectAction={onSelectAction}
      />
    );

    expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Only overdue' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Include actions' })).toBeInTheDocument();
    expect(screen.getByText('Project progress')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Launch Alpha'));
    fireEvent.click(screen.getByText('Release lesson 6'));

    expect(onSelectProject).toHaveBeenCalledWith('/space/Projects/Alpha');
    expect(onSelectAction).toHaveBeenCalledWith('/space/Projects/Alpha/Actions/release.md');
  });

  it('toggles actions and overdue filtering with stable empty states', () => {
    render(
      <UpcomingDeadlinesCard
        projects={[
          buildProject({
            name: 'Overdue Project',
            path: '/space/Projects/Overdue',
            dueDate: '2026-03-28',
          }),
        ]}
        actions={[
          buildAction({
            name: 'Future Action',
            path: '/space/Projects/Alpha/Actions/future.md',
            dueDate: '2026-04-06',
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Include actions' }));
    expect(screen.queryByText('Future Action')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Only overdue' }));
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue Project')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Only overdue' }));
    expect(screen.getByText('No upcoming deadlines this week')).toBeInTheDocument();
  });

  it('shows empty states for no overdue items and no upcoming deadlines', () => {
    const { rerender } = render(
      <UpcomingDeadlinesCard
        projects={[]}
        actions={[]}
      />
    );

    expect(screen.getByText('No upcoming deadlines this week')).toBeInTheDocument();

    rerender(
      <UpcomingDeadlinesCard
        projects={[
          buildProject({
            name: 'Soon Project',
            path: '/space/Projects/Soon',
            dueDate: '2026-04-06',
          }),
        ]}
        actions={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Only overdue' }));
    expect(screen.getByText('No overdue items')).toBeInTheDocument();
  });
});
