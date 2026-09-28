/**
 * Parse an item-attribute min/max input into what the API stores.
 * '' (or whitespace) means "no bound" → null. Anything that doesn't parse to a
 * finite number (e.g. "1e999" → Infinity) is also treated as no bound rather
 * than being sent as Infinity/NaN, which the API would reject.
 */
export function toBound(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}
