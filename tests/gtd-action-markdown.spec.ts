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

  it('rebuilds updated horizon references instead of preserving stale raw payloads', () => {
    const content = [
      '# Review Docs',
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
      'Review the draft.',
      '',
      '## References',
      '[!references:]',
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

    const rebuilt = rebuildActionMarkdown(content, {
      horizonReferences: {
        projects: ['/Space/Projects/Beta'],
        areas: [],
        goals: [],
        vision: [],
        purpose: [],
      },
    });

    expect(rebuilt).toContain(
      `[!projects-references:${encodeURIComponent(JSON.stringify(['/Space/Projects/Beta']))}]`
    );
    expect(rebuilt).not.toContain('/Space/Projects/Alpha');
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

  it('parses and strips legacy action headers generated by the older template helpers', () => {
    const content = [
      '# Legacy Action',
      '',
      '<div data-singleselect=\'{"type":"status","value":"waiting","label":"Status"}\' class="singleselect-block">Status: waiting</div>',
      '',
      '## Focus Date',
      '1/17/2025, 10:30 AM',
      '',
      '## Due Date',
      '2025-01-20',
      '',
      '<div data-singleselect=\'{"type":"effort","value":"large","label":"Effort"}\' class="singleselect-block">Effort: large</div>',
      '',
      '## Notes',
      'Carry this body forward.',
      '',
      '---',
      'Created: 2025-01-17T12:00:00Z',
    ].join('\n');

    const parsed = parseActionMarkdown(content);

    expect(parsed.status).toBe('waiting');
    expect(parsed.effort).toBe('large');
    expect(parsed.focusDate).toBe('2025-01-17');
    expect(parsed.dueDate).toBe('2025-01-20');
    expect(parsed.body).toBe('## Notes\nCarry this body forward.');
  });

  it('leaves createdDateTime undefined when the created marker is missing', () => {
    const parsed = parseActionMarkdown([
      '# Action Without Created Marker',
      '',
      '## Status',
      '[!singleselect:status:in-progress]',
      '',
      '## Focus Date',
      '[!datetime:focus_date:2026-03-01]',
      '',
      'Action body.',
    ].join('\n'));

    expect(parsed.createdDateTime).toBeUndefined();
  });
});
