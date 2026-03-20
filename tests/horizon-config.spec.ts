import { describe, expect, it } from 'vitest';
import { HORIZON_CONFIG, detectHorizonTypeFromPath } from '@/utils/horizon-config';

describe('horizon config', () => {
  it('defines the expected singular list tokens and default cadences', () => {
    expect(HORIZON_CONFIG.purpose.listToken).toBe('purpose-list');
    expect(HORIZON_CONFIG.purpose.defaultCadence).toBe('on-demand');

    expect(HORIZON_CONFIG.vision.listToken).toBe('vision-list');
    expect(HORIZON_CONFIG.vision.defaultCadence).toBe('annually');

    expect(HORIZON_CONFIG.goals.listToken).toBe('goals-list');
    expect(HORIZON_CONFIG.goals.defaultCadence).toBe('quarterly');

    expect(HORIZON_CONFIG.areas.listToken).toBe('areas-list');
    expect(HORIZON_CONFIG.areas.defaultCadence).toBe('monthly');
  });

  it('detects horizon types from overview README paths', () => {
    expect(detectHorizonTypeFromPath('/Space/Purpose & Principles/README.md')).toBe('purpose');
    expect(detectHorizonTypeFromPath('/Space/Vision/README.md')).toBe('vision');
    expect(detectHorizonTypeFromPath('/Space/Goals/README.md')).toBe('goals');
    expect(detectHorizonTypeFromPath('/Space/Areas of Focus/README.md')).toBe('areas');
  });

  it('supports windows-style separators and ignores non-overview paths', () => {
    expect(detectHorizonTypeFromPath('C:\\Space\\Vision\\README.md')).toBe('vision');
    expect(detectHorizonTypeFromPath('/Space/Vision/North Star.md')).toBeNull();
    expect(detectHorizonTypeFromPath('/Space/Projects/Alpha/README.md')).toBeNull();
  });
});
