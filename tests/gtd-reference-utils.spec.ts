import { describe, expect, it } from 'vitest';
import { normalizeProjectPathFromReadme } from '@/utils/gtd-reference-utils';

describe('gtd reference utils', () => {
  it('normalizes project paths from absolute, root-relative, and bare readme paths', () => {
    expect(
      normalizeProjectPathFromReadme('/Users/plebdev/Desktop/code/gtdspace/Projects/Alpha/README.md')
    ).toBe('/Users/plebdev/Desktop/code/gtdspace/Projects/Alpha');
    expect(normalizeProjectPathFromReadme('/Projects/Alpha/README.md')).toBe('/Projects/Alpha');
    expect(normalizeProjectPathFromReadme('Projects/Alpha/README')).toBe('Projects/Alpha');
  });
});
