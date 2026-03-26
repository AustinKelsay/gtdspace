import { describe, expect, it } from 'vitest';
import { canonicalizeLegacySectionAliases, norm } from '@/utils/path';

describe('path utils', () => {
  it('canonicalizes the legacy purpose section alias in normalized paths', () => {
    expect(norm('/mock/workspace/Purpose and Principles/Mission.md')).toBe(
      '/mock/workspace/Purpose & Principles/Mission.md',
    );
  });

  it('canonicalizes the legacy purpose section alias in windows-style paths', () => {
    expect(canonicalizeLegacySectionAliases(String.raw`C:\mock\Purpose and Principles\Mission.md`)).toBe(
      'C:/mock/Purpose & Principles/Mission.md',
    );
  });
});
