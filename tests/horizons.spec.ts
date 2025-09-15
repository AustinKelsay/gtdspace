import { describe, it, expect } from 'vitest';
import type { HorizonFile } from '@/hooks/useHorizonsRelationships';
import { mergeProjectInfoIntoHorizonFiles } from '@/utils/horizons';
import type { ProjectLike } from '@/utils/horizons';

describe('mergeProjectInfoIntoHorizonFiles', () => {
  it('merges status, dueDate, description, and action_count for matching projects', () => {
    const files: HorizonFile[] = [
      {
        id: '/Space/Projects/Alpha/README.md',
        name: 'README.md',
        path: '/Space/Projects/Alpha/README.md',
        size: 0,
        last_modified: Date.now(),
        extension: 'md',
        horizonLevel: 'Projects',
        linkedTo: [],
        linkedFrom: [],
        content: 'Alpha project'
      },
      {
        id: '/Space/Projects/Beta/README.md',
        name: 'README.md',
        path: '/Space/Projects/Beta/README.md',
        size: 0,
        last_modified: Date.now(),
        extension: 'md',
        horizonLevel: 'Projects',
        linkedTo: [],
        linkedFrom: [],
        content: 'Beta project'
      }
    ];

    const projects: ProjectLike[] = [
      {
        path: '/Space/Projects/Alpha',
        name: 'Alpha',
        status: 'in-progress',
        dueDate: '2025-12-31',
        description: 'Alpha desc',
        actionStats: { total: 5 }
      },
      {
        path: '/Space/Projects/Gamma',
        name: 'Gamma',
        status: 'waiting',
        actionStats: { total: 2 }
      }
    ];
    const merged = mergeProjectInfoIntoHorizonFiles(files, projects);

    const alpha = merged.find(f => f.path.includes('/Alpha/'));
    const beta = merged.find(f => f.path.includes('/Beta/'));
    expect(alpha).toBeDefined();
    expect(beta).toBeDefined();

    expect(alpha?.status).toBe('in-progress');
    expect(alpha?.dueDate).toBe('2025-12-31');
    expect(alpha?.description).toBe('Alpha desc');
    expect(alpha?.action_count).toBe(5);

    // Non-matching project should remain unchanged
    expect(beta?.status).toBeUndefined();
    expect(beta?.action_count).toBeUndefined();
  });
});
