// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardActions from '@/components/dashboard/DashboardActions';
import type { ActionItem } from '@/hooks/useActionsData';

const buildAction = (overrides: Partial<ActionItem>): ActionItem => ({
  id: '/space/projects/default/action.md',
  name: 'Default Action',
  path: '/space/projects/default/action.md',
  projectName: 'Default',
  projectPath: '/space/projects/default',
  status: 'in-progress',
  effort: 'medium',
  dueDate: '2099-01-01',
  focusDate: '2099-01-02',
  contexts: ['office'],
  references: [],
  createdDate: '2026-01-01',
  modifiedDate: '2026-01-02',
  ...overrides,
});

describe('DashboardActions component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const actions: ActionItem[] = [
    buildAction({
      id: '/space/projects/alpha/next-step.md',
      name: 'Alpha Next Step',
      path: '/space/projects/alpha/next-step.md',
      projectName: 'Alpha',
      projectPath: '/space/projects/alpha',
      status: 'in-progress',
      effort: 'small',
    }),
    buildAction({
      id: '/space/projects/beta/waiting-task.md',
      name: 'Waiting Task',
      path: '/space/projects/beta/waiting-task.md',
      projectName: 'Beta',
      projectPath: '/space/projects/beta',
      status: 'waiting',
      contexts: ['home'],
    }),
    buildAction({
      id: '/space/projects/gamma/completed-cleanup.md',
      name: 'Completed Cleanup',
      path: '/space/projects/gamma/completed-cleanup.md',
      projectName: 'Gamma',
      projectPath: '/space/projects/gamma',
      status: 'completed',
    }),
  ];

  const projects = [
    { name: 'Alpha', path: '/space/projects/alpha' },
    { name: 'Beta', path: '/space/projects/beta' },
    { name: 'Gamma', path: '/space/projects/gamma' },
  ];

  it('applies the default status filter to show only in-progress and waiting actions', () => {
    render(<DashboardActions actions={actions} projects={projects} />);

    expect(screen.getAllByText('Alpha Next Step').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Waiting Task').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Completed Cleanup')).toHaveLength(0);
    expect(screen.getByText('2 actions')).toBeInTheDocument();
  });

  it('filters by search query and triggers row selection callback', () => {
    const onSelectAction = vi.fn();
    render(
      <DashboardActions actions={actions} projects={projects} onSelectAction={onSelectAction} />
    );

    fireEvent.change(screen.getByPlaceholderText('Search actions, projects, or contexts...'), {
      target: { value: 'Waiting' },
    });

    expect(screen.getAllByText('Waiting Task').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Alpha Next Step')).toHaveLength(0);

    const waitingCard = screen
      .getAllByText('Waiting Task')
      .map((element) => element.closest('[role="button"]'))
      .find((element): element is HTMLElement => element instanceof HTMLElement);

    expect(waitingCard).toBeTruthy();
    fireEvent.click(waitingCard!);
    expect(onSelectAction).toHaveBeenCalledTimes(1);
    expect(onSelectAction.mock.calls[0][0]).toMatchObject({
      id: '/space/projects/beta/waiting-task.md',
      status: 'waiting',
    });
  });

  it('shows empty-results message when filters remove all actions', () => {
    render(<DashboardActions actions={actions} projects={projects} />);

    fireEvent.change(screen.getByPlaceholderText('Search actions, projects, or contexts...'), {
      target: { value: 'zzzz-no-match' },
    });

    expect(screen.getByText('No actions match your filters')).toBeInTheDocument();
  });

  it('does not mark actions due today as overdue', () => {
    render(
      <DashboardActions
        actions={[
          buildAction({
            id: '/space/projects/alpha/due-today.md',
            name: 'Due Today',
            path: '/space/projects/alpha/due-today.md',
            projectName: 'Alpha',
            projectPath: '/space/projects/alpha',
            dueDate: '2026-01-15',
          }),
        ]}
        projects={projects}
      />
    );

    expect(screen.getAllByText('Due Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.queryByText('1 overdue')).not.toBeInTheDocument();
  });

  it('does not count completed overdue actions in the overdue summary', () => {
    render(
      <DashboardActions
        actions={[
          buildAction({
            id: '/space/projects/gamma/finished-overdue.md',
            name: 'Finished Overdue',
            path: '/space/projects/gamma/finished-overdue.md',
            projectName: 'Gamma',
            projectPath: '/space/projects/gamma',
            status: 'completed',
            dueDate: '2026-01-10',
          }),
        ]}
        projects={projects}
      />
    );

    expect(screen.queryByText('1 overdue')).not.toBeInTheDocument();
  });
});
