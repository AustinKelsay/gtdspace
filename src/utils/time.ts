/**
 * Time utilities shared across hooks/components.
 */

/**
 * Convert epoch (seconds or milliseconds) to ISO string safely.
 * - If value is >= 1e10, it is treated as milliseconds.
 * - Otherwise, it is treated as seconds and multiplied by 1000.
 * - This threshold correctly handles timestamps until the year 2286.
 */
export function toISOStringFromEpoch(epoch?: number | null): string {
  const ts = typeof epoch === 'number' && Number.isFinite(epoch) ? epoch : 0;
  const ms = ts >= 1e10 ? ts : ts * 1000;
  return new Date(ms).toISOString();
}

/**
 * Return the local date portion as YYYY-MM-DD.
 */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

