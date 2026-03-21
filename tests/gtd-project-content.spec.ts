import { describe, expect, it } from 'vitest';
import { buildProjectMarkdown } from '@/utils/gtd-markdown-helpers';
import {
  parseProjectMarkdown,
  sanitizeProjectAdditionalContent,
} from '@/utils/gtd-project-content';

describe('gtd project content utilities', () => {
  it('parses canonical project markdown into editable sections', () => {
    const content = buildProjectMarkdown({
      title: 'Alpha Project',
      status: 'waiting',
      dueDate: '2026-03-10',
      desiredOutcome: 'Ship the planning update.',
      horizonReferences: {
        areas: ['Areas/Operations.md'],
        goals: ['Goals/Launch.md'],
        vision: [],
        purpose: [],
      },
      references: ['Cabinet/Project Notes.md'],
      createdDateTime: '2026-02-20T10:00:00Z',
      includeHabitsList: true,
      additionalContent: '## Project Notes\nKeep this moving.',
    });

    const parsed = parseProjectMarkdown(content);

    expect(parsed.title).toBe('Alpha Project');
    expect(parsed.status).toBe('waiting');
    expect(parsed.dueDate).toBe('2026-03-10');
    expect(parsed.horizonReferences.areas).toEqual(['Areas/Operations.md']);
    expect(parsed.references).toEqual(['Cabinet/Project Notes.md']);
    expect(parsed.includeHabitsList).toBe(true);
    expect(parsed.additionalContent).toBe('## Project Notes\nKeep this moving.');
  });

  it('removes duplicated canonical reference sections from trailing content', () => {
    const sanitized = sanitizeProjectAdditionalContent(
      [
        '## Notes',
        'Keep the freeform notes.',
        '',
        '## References (optional)',
        '[!references:Cabinet/Ignore.md]',
        '',
        '## Horizon References (optional)',
        '[!areas-references:Areas/Ignore.md]',
      ].join('\n')
    );

    expect(sanitized).toBe('## Notes\nKeep the freeform notes.');
  });
});
