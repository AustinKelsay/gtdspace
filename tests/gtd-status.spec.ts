import { describe, expect, it } from 'vitest';
import { normalizeStatus } from '@/utils/gtd-status';

describe('gtd status normalization', () => {
  it('defaults missing statuses to in-progress', () => {
    expect(normalizeStatus()).toBe('in-progress');
    expect(normalizeStatus(null)).toBe('in-progress');
    expect(normalizeStatus('')).toBe('in-progress');
  });

  it('normalizes waiting-style aliases', () => {
    expect(normalizeStatus('waiting')).toBe('waiting');
    expect(normalizeStatus('blocked')).toBe('waiting');
    expect(normalizeStatus('on hold')).toBe('waiting');
    expect(normalizeStatus('waiting_for')).toBe('waiting');
  });

  it('normalizes cancelled aliases', () => {
    expect(normalizeStatus('cancelled')).toBe('cancelled');
    expect(normalizeStatus('canceled')).toBe('cancelled');
    expect(normalizeStatus('cancel')).toBe('cancelled');
  });

  it('normalizes in-progress aliases', () => {
    expect(normalizeStatus('planning')).toBe('in-progress');
    expect(normalizeStatus('not started')).toBe('in-progress');
    expect(normalizeStatus('todo')).toBe('in-progress');
    expect(normalizeStatus('doing')).toBe('in-progress');
  });

  it('normalizes completed aliases', () => {
    expect(normalizeStatus('completed')).toBe('completed');
    expect(normalizeStatus('complete')).toBe('completed');
    expect(normalizeStatus('done')).toBe('completed');
  });
});
