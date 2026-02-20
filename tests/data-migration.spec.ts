import { describe, expect, it } from 'vitest';
import {
  migrateGTDObject,
  migrateGTDObjects,
  migrateMarkdownContent,
  needsMigration,
} from '@/utils/data-migration';

describe('data migration utilities', () => {
  it('renames legacy datetime fields and legacy headers in markdown content', () => {
    const input = [
      '## Created Date',
      '[!datetime:created_date:2026-02-20T09:30:00Z]',
      '[!datetime:focus_date_time:2026-03-01]',
    ].join('\n');

    const migrated = migrateMarkdownContent(input);

    expect(migrated).toContain('## Created Date/Time');
    expect(migrated).toContain('[!datetime:created_date_time:2026-02-20T09:30:00Z]');
    expect(migrated).toContain('[!datetime:focus_date:2026-03-01]');
  });

  it('converts multiselect status fields to singleselect using the first value', () => {
    const input = [
      '[!multiselect:status:planning,waiting]',
      '[!multiselect:project-status:on-hold,cancelled]',
      '[!multiselect:effort:large,small]',
    ].join('\n');

    const migrated = migrateMarkdownContent(input);

    expect(migrated).toContain('[!singleselect:status:in-progress]');
    expect(migrated).toContain('[!singleselect:project-status:waiting]');
    expect(migrated).toContain('[!singleselect:effort:large]');
  });

  it('normalizes singleselect status values with case and spacing differences', () => {
    const input = [
      '[!singleselect:status:Not Started]',
      '[!singleselect:project-status:Waiting For]',
      '[!singleselect:status:Done]',
      '[!singleselect:status:Complete]',
    ].join('\n');

    const migrated = migrateMarkdownContent(input);

    expect(migrated).toContain('[!singleselect:status:in-progress]');
    expect(migrated).toContain('[!singleselect:project-status:waiting]');
    expect(migrated).toContain('[!singleselect:status:completed]');
  });

  it('detects old patterns that need migration', () => {
    expect(needsMigration('[!datetime:created_date:2026-01-01]')).toBe(true);
    expect(needsMigration('[!datetime:focus_date_time:2026-01-01]')).toBe(true);
    expect(needsMigration('[!multiselect:status:planning]')).toBe(true);
    expect(needsMigration('[!singleselect:project-status:on-hold]')).toBe(true);
  });

  it('does not flag already canonical markdown as needing migration', () => {
    const canonical = [
      '[!datetime:created_date_time:2026-02-20T10:00:00Z]',
      '[!datetime:focus_date:2026-03-01]',
      '[!singleselect:status:in-progress]',
      '[!singleselect:project-status:completed]',
      '[!singleselect:effort:medium]',
    ].join('\n');

    expect(needsMigration(canonical)).toBe(false);
  });

  it('migrates object snake_case date fields to camelCase and status tokens', () => {
    const migrated = migrateGTDObject({
      created_date: '2026-01-01',
      due_date: '2026-01-03',
      focus_date_time: '2026-01-04T08:00:00Z',
      end_date: '2026-01-05',
      completed_date: '2026-01-06',
      modified_date: '2026-01-07',
      status: 'On Hold',
      keepMe: 'present',
    });

    expect(migrated).toMatchObject({
      createdDateTime: '2026-01-01',
      dueDate: '2026-01-03',
      focusDate: '2026-01-04T08:00:00Z',
      endDate: '2026-01-05',
      completedDate: '2026-01-06',
      modifiedDate: '2026-01-07',
      status: 'waiting',
      keepMe: 'present',
    });
    expect(migrated).not.toHaveProperty('created_date');
    expect(migrated).not.toHaveProperty('due_date');
  });

  it('prefers created_date_time over created_date when both exist', () => {
    const migrated = migrateGTDObject<Record<string, unknown>>({
      created_date: '2026-01-01',
      created_date_time: '2026-01-01T09:00:00Z',
    });

    expect(migrated.createdDateTime).toBe('2026-01-01T09:00:00Z');
  });

  it('normalizes unknown status values into lowercase slugs', () => {
    const migrated = migrateGTDObject({ status: 'Need Review Soon' });
    expect(migrated.status).toBe('need-review-soon');
  });

  it('batch migrates GTD objects', () => {
    const input = [
      { status: 'Done', due_date: '2026-01-02' },
      { status: 'Active', created_date_time: '2026-01-03T09:00:00Z' },
    ];

    const migrated = migrateGTDObjects(input);

    expect(migrated[0]).toMatchObject({ status: 'completed', dueDate: '2026-01-02' });
    expect(migrated[1]).toMatchObject({
      status: 'in-progress',
      createdDateTime: '2026-01-03T09:00:00Z',
    });
  });
});
