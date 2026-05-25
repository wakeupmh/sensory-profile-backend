/**
 * Date utilities shared across services.
 */

/**
 * Normalize a Date / ISO string / null / undefined into a 'YYYY-MM-DD' string
 * (or null when the input is missing or invalid).
 *
 * - Date instances: serialized via toISOString() then sliced to date portion.
 * - Strings: parsed via the Date constructor; invalid strings → null.
 * - null / undefined → null.
 */
export function formatDateString(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  if (typeof date === 'string') {
    // If already in YYYY-MM-DD form, return as-is.
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}
