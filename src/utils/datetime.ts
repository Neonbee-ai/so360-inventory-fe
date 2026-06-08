/**
 * Parse a value into a Date, treating timezone-less timestamp strings
 * (Postgres "timestamp without time zone") as UTC instead of browser-local.
 * Idempotent: values already carrying Z or a ±HH:MM offset, Date objects,
 * epoch numbers, and date-only strings are left untouched.
 */
export function parseUtcDate(value: string | number | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  if (value == null) return new Date(NaN);
  if (typeof value === 'number') return new Date(value);
  const s = String(value).trim();
  const hasTime = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s);
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  return hasTime && !hasTz ? new Date(s.replace(' ', 'T') + 'Z') : new Date(s);
}
