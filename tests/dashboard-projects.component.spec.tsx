// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardProjects from '@/components/dashboard/DashboardProjects';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';

const buildProject = (overrides: Partial<ProjectWithMetadata>): ProjectWithMetadata => ({
  name: 'Default Project',
  description: 'Default description',
  dueDate: '2099-01-10',
  status: 'in-progress',
  path: '/space/projects/default',
  createdDateTime: '2026-01-01T10:00:00Z',
  action_count: 0,
  actionStats: { total: 3, completed: 1, inProgress: 1, waiting: 1, cancelled: 0 },
  completionPercentage: 33,
  linkedAreas: [],
  linkedGoals: [],
  linkedVision: [],
  linkedPurpose: [],
  ...overrides,
});

describe('DashboardProjects component', () => {
  const projects: ProjectWithMetadata[] = [
    buildProject({
      name: 'Alpha Roadmap',
      path: '/space/projects/alpha',
      status: 'in-progress',
      completionPercentage: 40,
    }),
    buildProject({
      name: 'Beta Dependencies',
      path: '/space/projects/beta',
      status: 'waiting',
      completionPercentage: 10,
    }),
    buildProject({
      name: 'Gamma Archive',
      path: '/space/projects/gamma',
      status: 'completed',
      completionPercentage: 100,
    }),
  ];

  it('applies the default status filter and supports creating a project', () => {
    const onCreateProject = vi.fn();
    render(<DashboardProjects projects={projects} onCreateProject={onCreateProject} />);

    expect(screen.getByText('Alpha Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Beta Dependencies')).toBeInTheDocument();
    expect(screen.queryByText('Gamma Archive')).not.toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Project' }));
    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });

  it('switches to list view and triggers project selection when row is clicked', () => {
    const onSelectProject = vi.fn();
    render(<DashboardProjects projects={projects} onSelectProject={onSelectProject} />);

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    fireEvent.click(screen.getAllByText('Alpha Roadmap')[0]);

    expect(onSelectProject).toHaveBeenCalledTimes(1);
    expect(onSelectProject.mock.calls[0][0]).toMatchObject({
      path: '/space/projects/alpha',
      status: 'in-progress',
    });
  });

  it('supports kanban mode and no-match search behavior', () => {
    render(<DashboardProjects projects={projects} />);

    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));
    expect(screen.getByLabelText('In Progress column')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search projects...'), {
      target: { value: 'zzzz-no-match' },
    });
    expect(screen.getByText('No projects match your filters')).toBeInTheDocument();
  });
});
