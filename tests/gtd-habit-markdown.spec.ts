import { describe, expect, it } from 'vitest';
import {
  calculateNextHabitReset,
  determineLastHabitResetDate,
  findLastHabitCompletionDate,
  parseHabitContent,
  parseHabitStatus,
} from '@/utils/gtd-habit-markdown';

describe('gtd habit markdown utilities', () => {
  it('parses habit content with normalized references and history rows', () => {
    const content = [
      '# Morning Review',
      '',
      '## Status',
      '[!checkbox:habit-status:true]',
      '',
      '## Frequency',
      '[!singleselect:habit-frequency:weekly]',
      '',
      '## Projects References',
      `[!projects-references:${encodeURIComponent(JSON.stringify(['/Space/Projects/Alpha/README.md', '/Space/Projects/Alpha']))}]`,
      '',
      '## References',
      `[!references:${encodeURIComponent(JSON.stringify(['/Space/Cabinet/Article.md']))}]`,
      '',
      '## Created',
      '[!datetime:created_date_time:2026-02-20T10:00:00Z]',
      '',
      '## Notes',
      'Review the active list.',
      '',
      '## History',
      '| Date | Time | Status | Action | Details |',
      '|------|------|--------|--------|---------|',
      '| 2026-03-01 | 8:15 AM | Complete | Manual | Wrapped up |',
      '| 2026-03-03 | 12:00 AM | To Do | Auto-Reset | New period |',
    ].join('\n');

    const parsed = parseHabitContent(content);

    expect(parsed.status).toBe('completed');
    expect(parsed.frequency).toBe('weekly');
    expect(parsed.references.projects).toEqual([
      '/Space/Projects/Alpha/README.md',
      '/Space/Projects/Alpha',
    ]);
    expect(parsed.generalReferences).toEqual(['/Space/Cabinet/Article.md']);
    expect(parsed.notes).toBe('Review the active list.');
    expect(parsed.historyRows).toHaveLength(2);
  });

  it('treats legacy singleselect complete values as completed', () => {
    const parsed = parseHabitContent([
      '# Legacy Habit',
      '',
      '## Status',
      '[!singleselect:habit-status:complete]',
      '',
      '## Frequency',
      '[!singleselect:habit-frequency:daily]',
      '',
      '## Created',
      '[!datetime:created_date_time:2026-03-01T08:00:00Z]',
    ].join('\n'));

    expect(parsed.status).toBe('completed');
  });

  it('treats completed checkbox markers as completed', () => {
    expect(parseHabitStatus('[!checkbox:habit-status:completed]')).toBe('completed');
  });

  it('calculates calendar-based reset boundaries for twice-weekly and monthly habits', () => {
    const twiceWeekly = calculateNextHabitReset('twice-weekly', new Date('2026-03-04T18:30:00'));
    const monthly = calculateNextHabitReset('monthly', new Date('2026-01-31T21:00:00'));

    expect(twiceWeekly.getFullYear()).toBe(2026);
    expect(twiceWeekly.getMonth()).toBe(2);
    expect(twiceWeekly.getDate()).toBe(6);
    expect(twiceWeekly.getHours()).toBe(0);
    expect(twiceWeekly.getMinutes()).toBe(0);

    expect(monthly.getFullYear()).toBe(2026);
    expect(monthly.getMonth()).toBe(1);
    expect(monthly.getDate()).toBe(1);
    expect(monthly.getHours()).toBe(0);
    expect(monthly.getMinutes()).toBe(0);
  });

  it('uses reset rows instead of completion rows for the reset anchor and completion summary', () => {
    const rows = [
      {
        date: '2026-03-01',
        time: '9:30 PM',
        status: 'Complete',
        action: 'Manual',
        details: 'Completed',
      },
      {
        date: '2026-03-03',
        time: '12:00 AM',
        status: 'To Do',
        action: 'Auto-Reset',
        details: 'New period',
      },
    ];

    const resetAnchor = determineLastHabitResetDate(rows, '2026-02-20T10:00:00Z');
    const lastCompletion = findLastHabitCompletionDate(rows);

    expect(resetAnchor?.getFullYear()).toBe(2026);
    expect(resetAnchor?.getMonth()).toBe(2);
    expect(resetAnchor?.getDate()).toBe(3);
    expect(resetAnchor?.getHours()).toBe(0);
    expect(resetAnchor?.getMinutes()).toBe(0);

    expect(lastCompletion?.getFullYear()).toBe(2026);
    expect(lastCompletion?.getMonth()).toBe(2);
    expect(lastCompletion?.getDate()).toBe(1);
    expect(lastCompletion?.getHours()).toBe(21);
    expect(lastCompletion?.getMinutes()).toBe(30);
  });

  it('uses the latest reset date regardless of row order', () => {
    const rows = [
      {
        date: '2026-03-05',
        time: '12:00 AM',
        status: 'To Do',
        action: 'Auto-Reset',
        details: 'Latest reset',
      },
      {
        date: '2026-03-01',
        time: '9:30 PM',
        status: 'Complete',
        action: 'Manual',
        details: 'Completed',
      },
      {
        date: '2026-03-03',
        time: '12:00 AM',
        status: 'To Do',
        action: 'Auto-Reset',
        details: 'Older reset',
      },
    ];

    const resetAnchor = determineLastHabitResetDate(rows, '2026-02-20T10:00:00Z');

    expect(resetAnchor?.getFullYear()).toBe(2026);
    expect(resetAnchor?.getMonth()).toBe(2);
    expect(resetAnchor?.getDate()).toBe(5);
    expect(resetAnchor?.getHours()).toBe(0);
    expect(resetAnchor?.getMinutes()).toBe(0);
  });

  it('falls back to the latest parseable history row before created when no reset rows exist', () => {
    const rows = [
      {
        date: '2026-03-01',
        time: '9:30 PM',
        status: 'Complete',
        action: 'Manual',
        details: 'Completed',
      },
      {
        date: '2026-03-04',
        time: '7:15 AM',
        status: 'To Do',
        action: 'Manual',
        details: 'Missed',
      },
    ];

    const resetAnchor = determineLastHabitResetDate(rows, '2026-02-20T10:00:00Z');

    expect(resetAnchor?.getFullYear()).toBe(2026);
    expect(resetAnchor?.getMonth()).toBe(2);
    expect(resetAnchor?.getDate()).toBe(4);
    expect(resetAnchor?.getHours()).toBe(7);
    expect(resetAnchor?.getMinutes()).toBe(15);
  });

  it('ignores incomplete rows when finding the last completion date', () => {
    const rows = [
      {
        date: '2026-03-01',
        time: '9:30 PM',
        status: 'Complete',
        action: 'Manual',
        details: 'Completed',
      },
      {
        date: '2026-03-03',
        time: '8:00 AM',
        status: 'Incomplete',
        action: 'Manual',
        details: 'Skipped',
      },
    ];

    const lastCompletion = findLastHabitCompletionDate(rows);

    expect(lastCompletion?.getFullYear()).toBe(2026);
    expect(lastCompletion?.getMonth()).toBe(2);
    expect(lastCompletion?.getDate()).toBe(1);
    expect(lastCompletion?.getHours()).toBe(21);
    expect(lastCompletion?.getMinutes()).toBe(30);
  });

  it('uses the latest completion date regardless of row order', () => {
    const rows = [
      {
        date: '2026-03-05',
        time: '6:15 AM',
        status: 'Complete',
        action: 'Manual',
        details: 'Latest',
      },
      {
        date: '2026-03-01',
        time: '9:30 PM',
        status: 'Complete',
        action: 'Manual',
        details: 'Older',
      },
    ];

    const lastCompletion = findLastHabitCompletionDate(rows);

    expect(lastCompletion?.getFullYear()).toBe(2026);
    expect(lastCompletion?.getMonth()).toBe(2);
    expect(lastCompletion?.getDate()).toBe(5);
    expect(lastCompletion?.getHours()).toBe(6);
    expect(lastCompletion?.getMinutes()).toBe(15);
  });
});
