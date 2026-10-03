import type { RateBoardEntry, RateBoardEntryInput } from '../services/inventoryService';

/** Feature flag that turns on the date-effective Rate Board. */
export const RATE_BOARD_FLAG = 'submodule:inventory:rate_board';

export const isRateBoardEnabled = (shell: any): boolean =>
    shell?.isFeatureEnabled?.(RATE_BOARD_FLAG) === true;

/** Local calendar date as YYYY-MM-DD. */
export const toIsoDate = (d: Date): string => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};

/** Stable row key: the variant when there is one, else the item. */
export const rowKey = (e: Pick<RateBoardEntry, 'item_id' | 'variant_id'>): string =>
    e.variant_id ? `${e.item_id}:${e.variant_id}` : e.item_id;

/** Percent change rounded to 2 decimals; null when there is no usable base. */
export const changePct = (previous: number | null, current: number | null): number | null => {
    if (previous == null || current == null || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 10000) / 100;
};

/**
 * Rows whose draft price differs from the loaded price. Blank or invalid
 * drafts are skipped so a stray clear never zeroes a price.
 */
export const changedEntries = (
    entries: RateBoardEntry[],
    drafts: Record<string, string>,
): RateBoardEntryInput[] => {
    const out: RateBoardEntryInput[] = [];
    for (const e of entries) {
        const raw = drafts[rowKey(e)];
        if (raw == null || raw.trim() === '') continue;
        const price = Number(raw);
        if (!Number.isFinite(price) || price < 0) continue;
        if (e.price != null && price === Number(e.price)) continue;
        out.push({
            item_id: e.item_id,
            variant_id: e.variant_id ?? null,
            price,
            ...(e.unit ? { unit: e.unit } : {}),
        });
    }
    return out;
};
