// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardHorizons from '@/components/dashboard/DashboardHorizons';
import type { HorizonFile, HorizonRelationship } from '@/hooks/useHorizonsRelationships';

const buildHorizonFile = (overrides: Partial<HorizonFile> = {}): HorizonFile => ({
  id: '/space/Goals/Quarter Goal.md',
  name: 'Quarter Goal.md',
  path: '/space/Goals/Quarter Goal.md',
  size: 0,
  last_modified: Math.floor(Date.parse('2026-03-31T08:00:00.000Z') / 1000),
  extension: 'md',
  horizonLevel: 'Goals',
  linkedTo: [],
  linkedFrom: [],
  content: 'Sample horizon content',
  createdDateTime: '2026-03-20T08:00:00.000Z',
  ...overrides,
});

const purpose = buildHorizonFile({
  id: '/space/Purpose & Principles/Purpose.md',
  name: 'Purpose.md',
  path: '/space/Purpose & Principles/Purpose.md',
  horizonLevel: 'Purpose & Principles',
});

const goal = buildHorizonFile({
  name: 'Quarter Goal.md',
  path: '/space/Goals/Quarter Goal.md',
  linkedTo: [purpose.path],
  linkedFrom: ['/space/Projects/Alpha/README.md'],
});

const goalSibling = buildHorizonFile({
  id: '/space/Goals/Secondary Goal.md',
  name: 'Secondary Goal.md',
  path: '/space/Goals/Secondary Goal.md',
  linkedFrom: ['/space/Projects/Alpha/README.md'],
});

const project = buildHorizonFile({
  id: '/space/Projects/Alpha/README.md',
  name: 'Alpha',
  path: '/space/Projects/Alpha/README.md',
  horizonLevel: 'Projects',
  linkedTo: [goal.path, goalSibling.path],
  status: 'in-progress',
});

const relationships: HorizonRelationship[] = [
  {
    from: project.path,
    to: goal.path,
    fromLevel: 'Projects',
    toLevel: 'Goals',
    fromName: 'Alpha',
    toName: 'Quarter Goal',
  },
  {
    from: project.path,
    to: goalSibling.path,
    fromLevel: 'Projects',
    toLevel: 'Goals',
    fromName: 'Alpha',
    toName: 'Secondary Goal',
  },
  {
    from: goal.path,
    to: purpose.path,
    fromLevel: 'Goals',
    toLevel: 'Purpose & Principles',
    fromName: 'Quarter Goal',
    toName: 'Purpose',
  },
];

const graph = {
  nodes: [
    { id: purpose.path, label: 'Purpose', level: 'Purpose & Principles', group: 0 },
    { id: goal.path, label: 'Quarter Goal', level: 'Goals', group: 2 },
    { id: goalSibling.path, label: 'Secondary Goal', level: 'Goals', group: 2 },
    { id: project.path, label: 'Alpha', level: 'Projects', group: 4 },
  ],
  edges: relationships.map((relationship) => ({
    from: relationship.from,
    to: relationship.to,
  })),
};

describe('DashboardHorizons', () => {
  it('renders the relationship map, opens a node, and shows inspector relationships', () => {
    const onSelectFile = vi.fn();
    const findRelated = vi.fn((filePath: string) => {
      if (filePath === goal.path) {
        return {
          parents: [project],
          children: [purpose],
          siblings: [goalSibling],
        };
      }
      return { parents: [], children: [], siblings: [] };
    });

    render(
      <DashboardHorizons
        horizonFiles={{
          'Purpose & Principles': [purpose],
          'Vision': [],
          'Goals': [goal, goalSibling],
          'Areas of Focus': [],
          'Projects': [project],
        }}
        projects={[]}
        relationships={relationships}
        graph={graph}
        findRelated={findRelated}
        onSelectFile={onSelectFile}
      />
    );

    expect(screen.getByLabelText('Horizon relationship map')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quarter Goal' }));

    expect(onSelectFile).toHaveBeenCalledWith(expect.objectContaining({ path: goal.path }));
    expect(findRelated).toHaveBeenCalledWith(goal.path);
    expect(screen.getByText('Parents')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Secondary Goal').length).toBeGreaterThan(0);
  });

  it('shows a filtered empty state when search removes all linked matches', () => {
    render(
      <DashboardHorizons
        horizonFiles={{
          'Purpose & Principles': [purpose],
          'Vision': [],
          'Goals': [goal],
          'Areas of Focus': [],
          'Projects': [project],
        }}
        projects={[]}
        relationships={relationships}
        graph={graph}
        findRelated={vi.fn(() => ({ parents: [], children: [], siblings: [] }))}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search across all horizons...'), {
      target: { value: 'missing-node' },
    });

    expect(screen.getByText('No relationships match the current filters')).toBeInTheDocument();
  });

  it('shows a workspace empty state when no horizon relationships exist', () => {
    render(
      <DashboardHorizons
        horizonFiles={{
          'Purpose & Principles': [purpose],
          'Vision': [],
          'Goals': [goal],
          'Areas of Focus': [],
          'Projects': [],
        }}
        projects={[]}
        relationships={[]}
        graph={{ nodes: [], edges: [] }}
        findRelated={vi.fn(() => ({ parents: [], children: [], siblings: [] }))}
      />
    );

    expect(screen.getByText('No horizon relationships yet')).toBeInTheDocument();
  });
});
