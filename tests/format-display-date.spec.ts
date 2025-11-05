import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDisplayDate } from '@/utils/format-display-date';

describe('formatDisplayDate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback for nullish and empty inputs', () => {
    expect(formatDisplayDate(null)).toBe('—');
    expect(formatDisplayDate(undefined)).toBe('—');
    expect(formatDisplayDate('')).toBe('—');
  });

  it('formats date-only strings with medium date style', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((_locale, options) => {
      return {
        format: () => `date:${options?.dateStyle ?? 'none'}|time:${options?.timeStyle ?? 'none'}`,
      } as unknown as Intl.DateTimeFormat;
    });

    const result = formatDisplayDate('2025-11-05');

    expect(result).toBe('date:medium|time:none');
    expect(spy).toHaveBeenCalledTimes(1);
    const callOptions = spy.mock.calls[0]?.[1];
    expect(callOptions?.dateStyle).toBe('medium');
    expect(callOptions?.timeStyle).toBeUndefined();
  });

  it('includes time style when the input contains a time component', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((_locale, options) => {
      return {
        format: () => `date:${options?.dateStyle ?? 'none'}|time:${options?.timeStyle ?? 'none'}`,
      } as unknown as Intl.DateTimeFormat;
    });

    const result = formatDisplayDate('2025-11-05T13:45');

    expect(result).toBe('date:medium|time:short');
    expect(spy).toHaveBeenCalledTimes(1);
    const callOptions = spy.mock.calls[0]?.[1];
    expect(callOptions?.dateStyle).toBe('medium');
    expect(callOptions?.timeStyle).toBe('short');
  });

  it('supports Date inputs with includeTime flag and custom separator', () => {
    const formattedParts: string[] = [];
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((_locale, options) => {
      return {
        format: () => {
          const part = options?.timeStyle
            ? `time:${options.timeStyle}`
            : `date:${options?.dateStyle ?? 'none'}`;
          formattedParts.push(part);
          return part;
        },
      } as unknown as Intl.DateTimeFormat;
    });

    const result = formatDisplayDate(new Date('2025-11-05T13:45'), {
      includeTime: true,
      timeSeparator: ' • ',
    });

    expect(result).toBe('date:medium • time:short');
    expect(formattedParts).toEqual(['date:medium', 'time:short']);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('returns the original trimmed string when parsing fails', () => {
    const raw = 'not-a-date';
    const spy = vi.spyOn(Intl, 'DateTimeFormat');

    const result = formatDisplayDate(raw);

    expect(result).toBe(raw);
    expect(spy).not.toHaveBeenCalled();
  });
});
