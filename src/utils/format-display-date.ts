const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type FormatDisplayDateInput = string | Date | null | undefined;

export interface FormatDisplayDateOptions {
  fallback?: string;
  includeTime?: boolean;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  timeSeparator?: string;
  locale?: string;
}

function toLocalDateFromParts(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(
  input: FormatDisplayDateInput,
  options: FormatDisplayDateOptions = {}
): string {
  const {
    fallback = '—',
    includeTime: includeTimeOverride,
    dateStyle = 'medium',
    timeStyle = 'short',
    timeSeparator,
    locale,
  } = options;

  if (input === null || typeof input === 'undefined') {
    return fallback;
  }

  let resolvedDate: Date | null = null;
  let includeTime = includeTimeOverride ?? false;
  let stringFallback: string | undefined;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return fallback;
    }
    stringFallback = trimmed;

    const dateOnlyMatch = trimmed.match(DATE_ONLY_PATTERN);
    if (dateOnlyMatch) {
      const [, yearStr, monthStr, dayStr] = dateOnlyMatch;
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
        return trimmed;
      }

      resolvedDate = toLocalDateFromParts(year, month, day);
      if (Number.isNaN(resolvedDate.getTime())) {
        return trimmed;
      }
      if (includeTimeOverride === undefined) {
        includeTime = false;
      }
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        return trimmed;
      }
      resolvedDate = parsed;
      if (includeTimeOverride === undefined) {
        includeTime = /T\d{2}:\d{2}/.test(trimmed);
      }
    }
  } else {
    if (!(input instanceof Date) || Number.isNaN(input.getTime())) {
      return fallback;
    }
    resolvedDate = input;
    if (includeTimeOverride === undefined) {
      includeTime = false;
    }
  }

  if (!resolvedDate) {
    return stringFallback ?? fallback;
  }

  try {
    if (includeTime) {
      if (timeSeparator) {
        const datePart = new Intl.DateTimeFormat(locale, {
          dateStyle,
        }).format(resolvedDate);
        const timePart = new Intl.DateTimeFormat(locale, {
          timeStyle,
        }).format(resolvedDate);
        return `${datePart}${timeSeparator}${timePart}`;
      }

      return new Intl.DateTimeFormat(locale, {
        dateStyle,
        timeStyle,
      }).format(resolvedDate);
    }

    return new Intl.DateTimeFormat(locale, {
      dateStyle,
    }).format(resolvedDate);
  } catch {
    if (stringFallback) {
      return stringFallback;
    }
    return resolvedDate.toISOString();
  }
}
