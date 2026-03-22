import { describe, expect, it } from 'vitest';
import { parseProjectMarkdown } from '@/utils/gtd-project-content';

describe('gtd project content parsing', () => {
  it('prefers Desired Outcome over Description when both are present', () => {
    const parsed = parseProjectMarkdown([
      '# Project',
      '',
      '## Desired Outcome',
      'Ship the feature.',
      '',
      '## Description',
      'Working notes that should not overwrite the outcome.',
      '',
      '## Actions',
      '[!actions-list]',
    ].join('\n'));

    expect(parsed.desiredOutcome).toBe('Ship the feature.');
  });
});
