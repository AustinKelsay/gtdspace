import { describe, expect, it } from 'vitest';
import {
  parseActionMarkdown,
  rebuildActionMarkdown,
  stripActionHeader,
} from '@/utils/gtd-action-markdown';

describe('gtd action markdown utilities', () => {
  it('parses action content into canonical metadata and body', () => {
    const content = [
      '# Draft Email',
      '',
      '## Status',
      '[!singleselect:status:waiting]',
      '',
      '## Focus Date',
      '[!datetime:focus_date:2026-03-01T15:30:00Z]',
      '',
      '## Due Date',
      '[!datetime:due_date:2026-03-05]',
      '',
      '## Effort',
      '[!singleselect:effort:large]',
      '',
      '## Contexts',
      '[!multiselect:contexts:email,deep work]',
      '',
      'Body paragraph one.',
      '',
      '## References',
      '[!references:Cabinet/Email Guide.md]',
      '',
      '## Horizon References (optional)',
      `[!projects-references:${encodeURIComponent(JSON.stringify(['/Space/Projects/Alpha']))}]`,
      '[!areas-references:]',
      '[!goals-references:]',
      '[!vision-references:]',
      '[!purpose-references:]',
      '',
      '## Created',
      '[!datetime:created_date_time:2026-02-20T10:00:00Z]',
    ].join('\n');

    const parsed = parseActionMarkdown(content);

    expect(parsed.title).toBe('Draft Email');
    expect(parsed.status).toBe('waiting');
    expect(parsed.effort).toBe('large');
    expect(parsed.contexts).toEqual(['email', 'deep work']);
    expect(parsed.references).toEqual(['Cabinet/Email Guide.md']);
    expect(parsed.horizonReferences.projects).toEqual(['/Space/Projects/Alpha']);
    expect(parsed.body).toContain('Body paragraph one.');
  });

  it('rebuilds action markdown with canonical status while preserving body and references', () => {
    const content = [
      '# Follow Up',
      '',
      '## Status',
      '[!singleselect:status:waiting]',
      '',
      '## Focus Date',
      '[!datetime:focus_date:2026-03-01T15:30:00Z]',
      '',
      '## Due Date',
      '[!datetime:due_date:2026-03-05]',
      '',
      '## Effort',
      '[!singleselect:effort:medium]',
      '',
      '## Contexts',
      '[!multiselect:contexts:email]',
      '',
      'Send the final follow-up.',
      '',
      '## References',
      '[!references:Cabinet/Playbook.md]',
      '',
      '## Horizon References (optional)',
      '[!projects-references:]',
      '[!areas-references:]',
      '[!goals-references:]',
      '[!vision-references:]',
      '[!purpose-references:]',
      '',
      '## Created',
      '[!datetime:created_date_time:2026-02-20T10:00:00Z]',
    ].join('\n');

    const rebuilt = rebuildActionMarkdown(content, {
      status: 'done',
      references: ['Cabinet/Playbook.md', 'Cabinet/Checklist.md'],
    });

    expect(rebuilt).toContain('[!singleselect:status:completed]');
    expect(rebuilt).toContain('[!references:Cabinet/Playbook.md,Cabinet/Checklist.md]');
    expect(rebuilt).toContain('Send the final follow-up.');
  });

  it('strips only the canonical action header blocks from the editor body', () => {
    const content = [
      '# Plan Call',
      '',
      '## Status',
      '[!singleselect:status:in-progress]',
      '',
      '## Focus Date',
      '[!datetime:focus_date:2026-03-01]',
      '',
      'Custom body paragraph.',
      '',
      '## Notes',
      'Keep the custom notes section in the body.',
      '',
      '## References',
      '[!references:Cabinet/Calls.md]',
    ].join('\n');

    expect(stripActionHeader(content)).toBe(
      ['Custom body paragraph.', '', '## Notes', 'Keep the custom notes section in the body.'].join('\n')
    );
  });
});
