/**
 * Formats an ISO timestamp into a short relative string like "5m ago".
 */
export function formatRelativeTimeShort(iso?: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  return `${Math.round(diff / day)}d ago`;
}

/**
 * Converts a Date object to a local ISO date string in YYYY-MM-DD format.
 * Uses local timezone, not UTC, to match stored date values.
 * @param date The date to convert.
 * @returns A date string in YYYY-MM-DD format.
 */
export function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts an epoch timestamp (in seconds) to an ISO 8601 string.
 * @param epochSeconds The epoch timestamp in seconds.
 * @returns An ISO 8601 formatted string.
 */
export function toISOStringFromEpoch(epochSeconds: number): string {
  // Convert seconds to milliseconds for Date constructor
  const date = new Date(epochSeconds * 1000);
  return date.toISOString();
}
