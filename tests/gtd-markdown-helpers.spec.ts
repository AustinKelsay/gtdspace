import { describe, expect, it } from 'vitest';
import {
  buildAreaMarkdown,
  buildGoalMarkdown,
  buildHabitMarkdown,
  buildProjectMarkdown,
  buildPurposeMarkdown,
  buildVisionMarkdown,
  DEFAULT_HABIT_HISTORY_BODY,
  encodeReferenceArray,
  encodeReferenceCsv,
  generateActionFileWithSingleSelect,
  generateProjectReadmeWithSingleSelect,
  generateMultiSelectMarkup,
  generateSingleSelectMarkup,
  mapLegacyEffort,
  mapLegacyStatus,
} from '@/utils/gtd-markdown-helpers';

describe('gtd markdown helper utilities', () => {
  it('encodes reference arrays as URI-safe JSON with normalized paths', () => {
    const encoded = encodeReferenceArray(['  Space\\Projects\\Alpha ', 'Space/Goals/Beta']);
    const decoded = JSON.parse(decodeURIComponent(encoded));
    expect(decoded).toEqual(['Space/Projects/Alpha', 'Space/Goals/Beta']);
  });

  it('returns empty string for empty or missing reference arrays', () => {
    expect(encodeReferenceArray([])).toBe('');
    expect(encodeReferenceArray()).toBe('');
  });

  it('normalizes and joins CSV references', () => {
    expect(encodeReferenceCsv(['A\\B.md', ' C/D.md ', '', '   '])).toBe('A/B.md,C/D.md');
  });

  it('escapes HTML in multiselect and singleselect markup output', () => {
    const multi = generateMultiSelectMarkup('tags', '<Tags>', ['x<script>', 'safe']);
    const single = generateSingleSelectMarkup('status', 'Status <now>', 'in-progress');

    expect(multi).toContain('&lt;Tags&gt;');
    expect(multi).toContain('x&lt;script&gt;');
    expect(multi).toContain("data-multiselect='");
    expect(single).toContain('&lt;now&gt;');
    expect(single).toContain("data-singleselect='");
  });

  it('shows empty-state text for singleselect markup when value is missing', () => {
    const output = generateSingleSelectMarkup('status', 'Status', '');
    expect(output).toContain('[No status selected]');
  });

  it('normalizes action markdown with safe defaults and escaped title text', () => {
    const output = generateActionFileWithSingleSelect(
      'Plan #1 [draft]',
      'unknown status',
      null,
      null,
      'massive',
      '2026-02-20T10:00:00Z<script>'
    );

    expect(output).toContain('# Plan \\#1 \\[draft\\]');
    expect(output).toContain('&quot;type&quot;:&quot;status&quot;,&quot;value&quot;:&quot;in-progress&quot;');
    expect(output).toContain('&quot;type&quot;:&quot;effort&quot;,&quot;value&quot;:&quot;medium&quot;');
    expect(output).toContain('Created: 2026-02-20T10:00:00Z&lt;script&gt;');
  });

  it('formats focus date display for non-ISO values and keeps due date fallback text', () => {
    const output = generateActionFileWithSingleSelect(
      'Draft Follow-up',
      'waiting',
      '2026-03-02',
      null,
      'small',
      '2026-02-20T10:00:00Z'
    );

    expect(output).toContain('## Focus Date\n2026-03-02');
    expect(output).toContain('## Due Date\nNot set');
    expect(output).toContain('&quot;value&quot;:&quot;waiting&quot;');
    expect(output).toContain('&quot;value&quot;:&quot;small&quot;');
  });

  it('builds project readme helper with escaped created date and due-date fallback', () => {
    const output = generateProjectReadmeWithSingleSelect(
      'Project X',
      'Body',
      null,
      '2026-02-20T10:00:00Z<script>'
    );

    expect(output).toContain('## Due Date\nNot set');
    expect(output).toContain('&quot;type&quot;:&quot;project-status&quot;,&quot;value&quot;:&quot;in-progress&quot;');
    expect(output).toContain('Created: 2026-02-20T10:00:00Z&lt;script&gt;');
  });

  it('maps legacy status and effort tokens to canonical values', () => {
    expect(mapLegacyStatus('Canceled')).toBe('cancelled');
    expect(mapLegacyStatus('In Progress')).toBe('in-progress');
    expect(mapLegacyEffort('Small')).toBe('small');
    expect(mapLegacyEffort('Extra Large')).toBe('extra large');
  });

  it('builds project markdown with normalized defaults and optional toggles', () => {
    const output = buildProjectMarkdown({
      title: 'Alpha Project',
      status: 'waiting',
      dueDate: '2026-03-10',
      desiredOutcome: '',
      horizonReferences: {
        areas: ['Areas/Health.md'],
        goals: ['Goals/Fitness.md'],
        vision: [],
        purpose: [],
      },
      references: ['Cabinet/Ref.md'],
      createdDateTime: '2026-02-20T10:00:00Z',
      includeHabitsList: false,
    });

    expect(output).toContain('[!singleselect:project-status:waiting]');
    expect(output).toContain('[!datetime:due_date:2026-03-10]');
    expect(output).toContain('[!actions-list]');
    expect(output).not.toContain('[!habits-list]');
    expect(output).toContain('[!references:Cabinet/Ref.md]');
  });

  it('builds project markdown with fallback status and appends additional content newline', () => {
    const output = buildProjectMarkdown({
      title: '  ',
      status: 'unknown' as never,
      dueDate: null,
      desiredOutcome: 'Ship MVP   ',
      horizonReferences: {
        areas: [],
        goals: [],
        vision: ['Vision/NorthStar.md'],
        purpose: ['Purpose/Mission.md'],
      },
      references: [],
      createdDateTime: '2026-02-20T10:00:00Z',
      includeHabitsList: true,
      additionalContent: '## Notes\nKeep momentum',
    });

    expect(output).toContain('# Untitled Project');
    expect(output).toContain('[!singleselect:project-status:in-progress]');
    expect(output).toContain('## Desired Outcome\nShip MVP');
    expect(output).toContain('[!habits-list]');
    expect(output).toContain('[!vision-references:');
    expect(output.endsWith('\n')).toBe(true);
  });

  it('builds habit markdown with boolean status and default history fallback', () => {
    const output = buildHabitMarkdown({
      title: 'Weekly Review',
      status: 'completed',
      frequency: 'weekly',
      references: { projects: [], areas: [], goals: [], vision: [], purpose: [] },
      generalReferences: ['Cabinet/GTD.md'],
      createdDateTime: '2026-02-20T10:00:00Z',
      history: '',
    });

    expect(output).toContain('[!checkbox:habit-status:true]');
    expect(output).toContain('[!singleselect:habit-frequency:weekly]');
    expect(output).toContain(DEFAULT_HABIT_HISTORY_BODY);
    expect(output).toContain('[!references:Cabinet/GTD.md]');
  });

  it('builds habit markdown with fallback frequency, optional focus date, and notes section', () => {
    const output = buildHabitMarkdown({
      title: '',
      status: 'todo',
      frequency: 'unsupported' as never,
      focusDateTime: '2026-03-01T09:00:00Z',
      references: {
        projects: ['Projects/Alpha.md'],
        areas: [],
        goals: [],
        vision: [],
        purpose: [],
      },
      createdDateTime: '2026-02-20T10:00:00Z',
      notes: 'Keep this concise   ',
      history: '| Date | Time | Status | Action | Details |',
    });

    expect(output).toContain('# Untitled');
    expect(output).toContain('[!singleselect:habit-frequency:daily]');
    expect(output).toContain('[!datetime:focus_date:2026-03-01T09:00:00Z]');
    expect(output).toContain('## Notes\nKeep this concise');
  });

  it('builds area and goal markdown with optional reference sections handled correctly', () => {
    const area = buildAreaMarkdown({
      title: 'Health',
      status: 'steady',
      reviewCadence: 'monthly',
      references: { projects: [], areas: [], goals: [], vision: [], purpose: [] },
      createdDateTime: '2026-02-20T10:00:00Z',
      description: '',
    });

    const goal = buildGoalMarkdown({
      title: 'Run Marathon',
      status: 'in-progress',
      targetDate: '',
      references: { projects: [], areas: [], vision: [], purpose: [] },
      createdDateTime: '2026-02-20T10:00:00Z',
      description: '',
    });

    expect(area).toContain('[!singleselect:area-status:steady]');
    expect(area).toContain('## Description');
    expect(area).not.toContain('## Vision References (optional)');
    expect(goal).toContain('[!singleselect:goal-status:in-progress]');
    expect(goal).not.toContain('[!datetime:goal-target-date:');
  });

  it('includes optional area/goal references and fallback statuses when inputs are invalid', () => {
    const area = buildAreaMarkdown({
      title: '',
      status: 'bad-status' as never,
      reviewCadence: 'bad-cadence' as never,
      references: {
        projects: [],
        areas: ['Areas/Meta.md'],
        goals: ['Goals/G1.md'],
        vision: ['Vision/V1.md'],
        purpose: ['Purpose/P1.md'],
      },
      generalReferences: [],
      createdDateTime: '2026-02-20T10:00:00Z',
      description: '  ',
    });

    const goal = buildGoalMarkdown({
      title: '',
      status: 'invalid' as never,
      targetDate: '2027-01-02',
      references: {
        projects: [],
        areas: [],
        vision: ['Vision/V2.md'],
        purpose: ['Purpose/P2.md'],
      },
      createdDateTime: '2026-02-20T10:00:00Z',
      description: '  ',
    });

    expect(area).toContain('[!singleselect:area-status:steady]');
    expect(area).toContain('[!singleselect:area-review-cadence:monthly]');
    expect(area).toContain('## Areas References (optional)');
    expect(area).toContain('## Vision References (optional)');
    expect(area).toContain('## Purpose & Principles References (optional)');
    expect(goal).toContain('# Untitled Goal');
    expect(goal).toContain('[!singleselect:goal-status:in-progress]');
    expect(goal).toContain('[!datetime:goal-target-date:2027-01-02]');
    expect(goal).toContain('## Vision References (optional)');
    expect(goal).toContain('## Purpose & Principles References (optional)');
  });

  it('builds vision and purpose markdown with fallback narrative and description content', () => {
    const vision = buildVisionMarkdown({
      title: 'Long Term',
      horizon: 'custom',
      references: { projects: [], goals: [], areas: [], purpose: [] },
      createdDateTime: '2026-02-20T10:00:00Z',
      narrative: '',
    });

    const purpose = buildPurposeMarkdown({
      title: 'Purpose',
      references: { projects: [], goals: [], vision: [], areas: [] },
      createdDateTime: '2026-02-20T10:00:00Z',
      description: '',
    });

    expect(vision).toContain('[!singleselect:vision-horizon:custom]');
    expect(vision).toContain('## Narrative');
    expect(purpose).toContain('## Description');
    expect(purpose).toContain('[!datetime:created_date_time:2026-02-20T10:00:00Z]');
  });

  it('includes optional purpose/areas references for vision and purpose documents', () => {
    const vision = buildVisionMarkdown({
      title: '',
      horizon: 'invalid' as never,
      references: {
        projects: [],
        goals: [],
        areas: [],
        purpose: ['Purpose/Compass.md'],
      },
      generalReferences: ['Cabinet/Vision.md'],
      createdDateTime: '2026-02-20T10:00:00Z',
      narrative: '  ',
    });

    const purpose = buildPurposeMarkdown({
      title: '',
      references: {
        projects: [],
        goals: [],
        vision: [],
        areas: ['Areas/Foundation.md'],
      },
      generalReferences: ['Cabinet/Purpose.md'],
      createdDateTime: '2026-02-20T10:00:00Z',
      description: '  ',
    });

    expect(vision).toContain('# Untitled Vision');
    expect(vision).toContain('[!singleselect:vision-horizon:3-years]');
    expect(vision).toContain('## Purpose & Principles References (optional)');
    expect(vision).toContain('[!purpose-references:');
    expect(vision).toContain('[!references:Cabinet/Vision.md]');
    expect(purpose).toContain('# Purpose & Principles');
    expect(purpose).toContain('## Areas References (optional)');
    expect(purpose).toContain('[!areas-references:');
    expect(purpose).toContain('[!references:Cabinet/Purpose.md]');
  });
});
