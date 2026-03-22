import { describe, expect, it } from 'vitest';
import {
  normalizeActionEffort,
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
    expect(parsed.createdDateTime).toBe('2025-01-17T12:00:00Z');
    expect(parsed.body).toBe('## Notes\nCarry this body forward.');
  });

  it('preserves a legacy created footer when rebuilding canonical markdown', () => {
    const content = [
      '# Legacy Action',
      '',
      '## Status',
      '[!singleselect:status:waiting]',
      '',
      'Action body.',
      '',
      '---',
      'Created: 2025-01-17T12:00:00Z',
    ].join('\n');

    const rebuilt = rebuildActionMarkdown(content, {
      status: 'done',
    });

    expect(rebuilt).toContain('[!datetime:created_date_time:2025-01-17T12:00:00Z]');
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

  it('keeps timezone-aware focus timestamps in UTC when deriving date-only fields', () => {
    const parsed = parseActionMarkdown([
      '# UTC Action',
      '',
      '## Status',
      '[!singleselect:status:in-progress]',
      '',
      '## Focus Date',
      '[!datetime:focus_date:2026-03-01T00:30:00Z]',
      '',
      '## Effort',
      '[!singleselect:effort:medium]',
    ].join('\n'));

    expect(parsed.focusDate).toBe('2026-03-01');
    expect(parsed.focusTime).toBe('00:30');
  });

  it('normalizes legacy extra large effort spellings', () => {
    expect(normalizeActionEffort('Extra Large')).toBe('extra-large');
    expect(normalizeActionEffort('extra_large')).toBe('extra-large');
    expect(normalizeActionEffort('ExtraLarge')).toBe('extra-large');
  });

  it('preserves local wall-clock focus datetimes when rebuilding from date and time', () => {
    const content = [
      '# Focus Block',
      '',
      '## Status',
      '[!singleselect:status:in-progress]',
      '',
      '## Focus Date',
      '[!datetime:focus_date:2026-03-01T09:00:00]',
      '',
      '## Due Date',
      '[!datetime:due_date:]',
      '',
      '## Effort',
      '[!singleselect:effort:medium]',
      '',
      'Body.',
      '',
      '## References',
      '[!references:]',
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
      focusDate: '2026-03-04',
      focusTime: '14:30',
    });

    expect(rebuilt).toContain('[!datetime:focus_date:2026-03-04T14:30:00]');
    expect(rebuilt).not.toContain('[!datetime:focus_date:2026-03-04T14:30:00Z]');
  });
});
