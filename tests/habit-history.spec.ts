import { describe, it, expect } from 'vitest';
import { __habitHistoryInternals } from '@/components/gtd/HabitPage';

const { splitHistory, reconstructHistory } = __habitHistoryInternals;

describe('habit history parsing and reconstruction', () => {
  it('inserts a blank line before the history table when intro exists', () => {
    const raw = [
      'This is the history intro paragraph.',
      '| Date | Time | Status | Action | Details |',
      '|------|------|--------|--------|---------|',
      '| 2024-01-01 | 09:00 | Complete | Reset | Did thing |',
    ].join('\n');

    const parsed = splitHistory(raw);
    const rebuilt = reconstructHistory(parsed.intro, parsed.header, parsed.rows, parsed.outro);

    expect(rebuilt).toContain('This is the history intro paragraph.\n\n| Date | Time | Status | Action | Details |');
  });

  it('preserves intro and outro text and formatting when rebuilding', () => {
    const raw = [
      'Intro line 1',
      '',
      'Intro line 3 after blank',
      '',
      '| Date | Time | Status | Action | Details |',
      '|------|------|--------|--------|---------|',
      '| 2024-01-01 | 09:00 | Complete | Reset | Did thing |',
      '',
      'After table line 1',
      '',
      'After table line 2',
    ].join('\n');

    const parsed = splitHistory(raw);
    const rebuilt = reconstructHistory(parsed.intro, parsed.header, parsed.rows, parsed.outro);
    const reparsed = splitHistory(rebuilt);

    expect(reparsed.intro).toEqual(parsed.intro);
    // We allow an extra leading blank line between the table and the outro,
    // but the substantive content (non-empty lines) should be identical.
    expect(reparsed.outro.trimStart()).toEqual(parsed.outro.trimStart());
  });

  it('preserves custom headers and extra columns', () => {
    const raw = [
      'History log',
      '',
      '| When | Time | State | Action | Note | Extra |',
      '|:-----|:----:|------:|--------|------|-------|',
      '| 2024-01-01 | 09:00 | Complete | Reset | First note | extra-1 |',
    ].join('\n');

    const parsed = splitHistory(raw);
    expect(parsed.header).toHaveLength(2);
    expect(parsed.header[0]).toBe('| When | Time | State | Action | Note | Extra |');
    expect(parsed.header[1]).toBe('|:-----|:----:|------:|--------|------|-------|');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].extraCells).toEqual(['extra-1']);

    const rebuilt = reconstructHistory(parsed.intro, parsed.header, parsed.rows, parsed.outro);
    const reparsed = splitHistory(rebuilt);

    expect(reparsed.header).toEqual(parsed.header);
    expect(reparsed.rows[0].extraCells).toEqual(['extra-1']);
  });

  it('does not stop parsing history table at blank spacer lines', () => {
    const raw = [
      '| Date | Time | Status | Action | Details |',
      '|------|------|--------|--------|---------|',
      '| 2024-01-01 | 09:00 | Complete | Reset | First row |',
      '',
      '| 2024-01-02 | 10:00 | To Do | Something | Second row |',
    ].join('\n');

    const parsed = splitHistory(raw);
    expect(parsed.rows).toHaveLength(2);
  });

  it('round-trips cells containing literal pipes using escaping', () => {
    const raw = [
      '| Date | Time | Status | Action | Details |',
      '|------|------|--------|--------|---------|',
      '| 2024-01-01 | 09:00 | Complete | Note | Had tea \\| lemon |',
    ].join('\n');

    const parsed = splitHistory(raw);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].details).toBe('Had tea | lemon');

    const rebuilt = reconstructHistory(parsed.intro, parsed.header, parsed.rows, parsed.outro);
    const reparsed = splitHistory(rebuilt);

    expect(reparsed.rows).toHaveLength(1);
    expect(reparsed.rows[0].details).toBe('Had tea | lemon');
  });

  it('serializes multiline details using <br> and round-trips them', () => {
    // Start from markdown that already uses <br> for line breaks
    const raw = [
      '| Date | Time | Status | Action | Details |',
      '|------|------|--------|--------|---------|',
      '| 2024-01-01 | 09:00 | Complete | Note | First line<br>Second line |',
    ].join('\n');

    const parsed = splitHistory(raw);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].details).toBe('First line\nSecond line');

    // Simulate editing in the UI: details now contains a literal newline
    const editedRows = [
      {
        ...parsed.rows[0],
        details: 'First line\nSecond line\nThird line',
      },
    ];

    const rebuilt = reconstructHistory(parsed.intro, parsed.header, editedRows, parsed.outro);
    const reparsed = splitHistory(rebuilt);

    expect(reparsed.rows).toHaveLength(1);
    expect(reparsed.rows[0].details).toBe('First line\nSecond line\nThird line');
  });
});
