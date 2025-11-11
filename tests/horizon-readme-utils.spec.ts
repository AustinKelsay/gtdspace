import { describe, it, expect } from 'vitest';
import { buildHorizonReadmeMarkdown, syncHorizonReadmeContent } from '@/utils/horizon-readme-utils';
import type { MarkdownFile } from '@/types';

describe('horizon README utilities', () => {
  it('builds canonical markdown with defaults when content is empty', () => {
    const { content, referenceCount } = buildHorizonReadmeMarkdown({
      horizon: 'goals',
      content: '',
      referencePaths: ['/Space/Goals/Grow Revenue.md'],
    });

    expect(content).toContain('# Goals Overview');
    expect(content).toContain('## Altitude');
    expect(content).toContain('[!singleselect:horizon-altitude:goals]');
    expect(content).toContain('## Reference Index');
    expect(content).toContain('[!goals-references:["/Space/Goals/Grow Revenue.md"]]');
    expect(content).toContain('## Horizon Pages');
    expect(content).toContain('[!goals-list]');
    expect(referenceCount).toBe(1);
  });

  it('preserves existing narrative sections when rebuilding', () => {
    const legacyContent = `# Goals Overview\n\n## Why this horizon matters\nExisting copy stays here.\n\n## Reference Index\n[!goals-references:[]]\n\n## Horizon Pages\n[!goals-list]\n`;

    const { content } = buildHorizonReadmeMarkdown({
      horizon: 'goals',
      content: legacyContent,
      referencePaths: ['/Space/Goals/Bravo.md'],
    });

    expect(content).toMatch(/## Why this horizon matters\s+Existing copy stays here\./);
    expect(content).toContain('[!goals-references:["/Space/Goals/Bravo.md"]]');
  });

  it('syncs README references by filtering README.md and sorting remaining files', () => {
    const files: MarkdownFile[] = [
      {
        id: '1',
        name: 'README.md',
        path: '/Space/Goals/README.md',
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      },
      {
        id: '2',
        name: 'Build Platform.md',
        path: '/Space/Goals/Build Platform.md',
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      },
      {
        id: '3',
        name: 'Acquire Users.md',
        path: '/Space/Goals/Acquire Users.md',
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      },
    ];

    const existingContent = `# Goals Overview\n\n## Reference Index\n[!goals-references:[]]\n\n## Horizon Pages\n[!goals-list]\n`;

    const result = syncHorizonReadmeContent({
      horizon: 'goals',
      existingContent,
      files,
    });

    expect(result.references).toEqual([
      '/Space/Goals/Acquire Users.md',
      '/Space/Goals/Build Platform.md',
    ]);
    expect(result.referenceCount).toBe(2);
  });
});
