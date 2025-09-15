/**
 * Time utilities shared across hooks/components.
 */

/**
 * Convert epoch (seconds or milliseconds) to ISO string safely.
 * - If value looks like milliseconds (>= 1e12), use as-is
 * - If value looks like seconds, multiply by 1000
 */
export function toISOStringFromEpoch(epoch?: number | null): string {
  const ts = typeof epoch === 'number' && Number.isFinite(epoch) ? epoch : 0;
  const ms = ts >= 1e12 ? ts : ts * 1000;
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

