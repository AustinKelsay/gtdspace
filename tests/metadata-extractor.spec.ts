import { describe, expect, it } from 'vitest';
import {
  addCustomExtractor,
  extractActionStatus,
  extractHorizonReferences,
  extractMetadata,
  extractProjectStatus,
  getMetadataChanges,
} from '@/utils/metadata-extractor';

describe('metadata extractor utilities', () => {
  it('extracts singleselect and datetime aliases into canonical keys', () => {
    const content = [
      '[!singleselect:project-status:waiting]',
      '[!singleselect:status:completed]',
      '[!datetime:due_date_time:2026-03-01]',
      '[!datetime:created_date:2026-02-20T10:00:00Z]',
    ].join('\n');

    const metadata = extractMetadata(content);

    expect(metadata.projectStatus).toBe('waiting');
    expect(metadata.status).toBe('completed');
    expect(metadata.dueDate).toBe('2026-03-01');
    expect(metadata.createdDateTime).toBe('2026-02-20T10:00:00Z');
  });

  it('merges repeated multiselect values for the same key', () => {
    const content = [
      '[!multiselect:tags:alpha,beta]',
      '[!multiselect:tags:gamma]',
    ].join('\n');

    const metadata = extractMetadata(content);
    expect(metadata.tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('parses horizon references from encoded JSON arrays and normalizes slashes', () => {
    const encoded = encodeURIComponent(
      JSON.stringify(['Space\\Areas\\Health.md', ' Space/Areas/Work.md '])
    );
    const content = `[!areas-references:${encoded}]`;

    const metadata = extractMetadata(content);
    expect(metadata.areasReferences).toEqual(['Space/Areas/Health.md', 'Space/Areas/Work.md']);
  });

  it('decodes double-encoded horizon references and handles malformed bracket payloads', () => {
    const doubleEncoded = encodeURIComponent(encodeURIComponent(JSON.stringify(['A.md', 'B.md'])));
    const malformed = '[!goals-references:["Goal A.md","Goal B.md"]';
    const content = `[!vision-references:${doubleEncoded}]\n${malformed}`;

    const metadata = extractMetadata(content);
    expect(metadata.visionReferences).toEqual(['A.md', 'B.md']);
    expect(metadata.goalsReferences).toEqual(['Goal A.md', 'Goal B.md']);
  });

  it('falls back to CSV parsing for references with quotes and blank entries', () => {
    const content = '[!references:"Ref One.md", , \'Ref Two.md\']';
    const metadata = extractMetadata(content);
    expect(metadata.references).toEqual(['Ref One.md', 'Ref Two.md']);
  });

  it('returns action and project status defaults when fields are absent', () => {
    const content = '# Example\nNo status tokens here';
    expect(extractActionStatus(content)).toBe('in-progress');
    expect(extractProjectStatus(content)).toBe('in-progress');
  });

  it('prefers project-status over generic status for project extraction', () => {
    const content = [
      '[!singleselect:status:completed]',
      '[!singleselect:project-status:waiting]',
    ].join('\n');

    expect(extractProjectStatus(content)).toBe('waiting');
  });

  it('returns structured horizon references with empty-array fallbacks', () => {
    const content = [
      '[!areas-references:["A1.md"]]',
      '[!projects-references:ProjectA.md,ProjectB.md]',
    ].join('\n');

    const refs = extractHorizonReferences(content);
    expect(refs).toEqual({
      areas: ['A1.md'],
      goals: [],
      vision: [],
      purpose: [],
      projects: ['ProjectA.md', 'ProjectB.md'],
      references: [],
    });
  });

  it('reports changed and removed metadata fields', () => {
    const oldMetadata = {
      status: 'in-progress',
      dueDate: '2026-02-20',
      tags: ['a', 'b'],
    };
    const nextMetadata = {
      status: 'completed',
      tags: ['a', 'b', 'c'],
      focusDate: '2026-03-01',
    };

    expect(getMetadataChanges(oldMetadata, nextMetadata)).toEqual({
      status: 'completed',
      tags: ['a', 'b', 'c'],
      focusDate: '2026-03-01',
      dueDate: undefined,
    });
  });

  it('registers and unregisters custom extractors and prevents duplicates', () => {
    const extractor = {
      pattern: /\[!custom-rating:(\d+)\]/g,
      extract: (match: RegExpMatchArray) => ({ key: 'customRating', value: match[1] }),
    };

    const unregister = addCustomExtractor(extractor);
    expect(extractMetadata('[!custom-rating:9]').customRating).toBe('9');

    unregister();
    expect(extractMetadata('[!custom-rating:9]').customRating).toBeUndefined();

    expect(() =>
      addCustomExtractor({
        pattern: /\[!singleselect:([\w-]+):([^\]]+)\]/g,
        extract: () => ({ key: 'duplicate', value: 'nope' }),
      })
    ).toThrow(/Duplicate metadata extractor pattern/);
  });
});
