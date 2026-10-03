import type { LossGroupBy, LossReason, LossSummary, StockCountLine, StockCountLineInput } from '../services/inventoryService';

/** Feature flags for the loss & yield pages. */
export const STOCK_COUNT_FLAG = 'submodule:inventory:stock_count';
export const LOSS_YIELD_FLAG = 'submodule:inventory:loss_yield';
export const BARCODE_SCANNING_FLAG = 'submodule:inventory:barcode_scanning';
/** Gates the 'mortality' reason category (retail ICP only). */
export const MORTALITY_TRACKING_FLAG = 'action:inventory:loss:mortality_tracking';

export const isFlagOn = (shell: any, flag: string): boolean =>
    shell?.isFeatureEnabled?.(flag) === true;

/** Active reasons, dropping 'mortality' ones unless that tracking is enabled. */
export const visibleReasons = (reasons: LossReason[], mortalityEnabled: boolean): LossReason[] =>
    reasons.filter((r) => r.is_active !== false && (mortalityEnabled || r.category !== 'mortality'));

/**
 * Drops mortality-category rows from a loss summary when mortality tracking
 * is off, and takes them out of the totals. `reason` rows match by reason
 * code, `category` rows by key; `item` rows carry no reason so stay as-is.
 * The daily trend has no per-reason split, so it cannot be adjusted.
 */
export const hideMortality = (
    summary: LossSummary,
    groupBy: LossGroupBy,
    reasons: LossReason[],
): LossSummary => {
    let isMortality: (key: string) => boolean;
    if (groupBy === 'category') {
        isMortality = (key) => key === 'mortality';
    } else if (groupBy === 'reason') {
        const codes = new Set(reasons.filter((r) => r.category === 'mortality').map((r) => r.code));
        isMortality = (key) => codes.has(key);
    } else {
        return summary;
    }
    const dropped = summary.rows.filter((r) => isMortality(r.key));
    if (dropped.length === 0) return summary;
    const sum = (k: 'qty' | 'value') => dropped.reduce((t, r) => t + (Number(r[k]) || 0), 0);
    const round = (n: number) => Math.round(n * 10000) / 10000;
    return {
        ...summary,
        total_value: round(Math.max(0, (Number(summary.total_value) || 0) - sum('value'))),
        total_qty: round(Math.max(0, (Number(summary.total_qty) || 0) - sum('qty'))),
        rows: summary.rows.filter((r) => !isMortality(r.key)),
    };
};

/** Stable key for a count line: variant when present, else item. */
export const lineKey = (l: Pick<StockCountLine, 'item_id' | 'variant_id'>): string =>
    l.variant_id ? `${l.item_id}:${l.variant_id}` : l.item_id;

const round = (n: number, dp = 4): number => {
    const f = 10 ** dp;
    return Math.round(n * f) / f;
};

/** Parses a typed quantity; blank or invalid gives null, negatives are rejected. */
export const parseQty = (raw: string | null | undefined): number | null => {
    if (raw == null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

/** actual − expected; null until an actual is entered. */
export const varianceOf = (expected: number, actual: number | null): number | null =>
    actual == null ? null : round(actual - Number(expected || 0));

export interface CountDraft {
    actual?: string;
    reason?: string;
}

/** Effective actual/reason for a line after applying the local draft. */
export const effectiveLine = (line: StockCountLine, draft?: CountDraft) => {
    const actual = draft?.actual !== undefined ? parseQty(draft.actual) : line.actual_qty ?? null;
    const reason = draft?.reason !== undefined ? draft.reason || null : line.reason_code ?? null;
    return { actual, reason, variance: varianceOf(line.expected_qty, actual) };
};

/** Lines whose draft changed actual or reason, as PATCH payload rows. */
export const changedCountLines = (
    lines: StockCountLine[],
    drafts: Record<string, CountDraft>,
): StockCountLineInput[] => {
    const out: StockCountLineInput[] = [];
    for (const l of lines) {
        const d = drafts[lineKey(l)];
        if (!d) continue;
        const { actual, reason } = effectiveLine(l, d);
        if (actual == null) continue;
        if (actual === (l.actual_qty ?? null) && reason === (l.reason_code ?? null)) continue;
        out.push({ item_id: l.item_id, variant_id: l.variant_id ?? null, actual_qty: actual, reason_code: reason });
    }
    return out;
};

/** Lines with a non-zero variance that still lack a reason (block posting). */
export const linesMissingReason = (lines: StockCountLine[], drafts: Record<string, CountDraft>): StockCountLine[] =>
    lines.filter((l) => {
        const { variance, reason } = effectiveLine(l, drafts[lineKey(l)]);
        return variance != null && variance !== 0 && !reason;
    });

/** Output total, loss and yield % for a conversion. Yield null without input. */
export const conversionYield = (inputQty: number | null, outputQtys: (number | null)[]) => {
    const output = round(outputQtys.reduce<number>((s, q) => s + (q ?? 0), 0));
    if (inputQty == null || inputQty <= 0) return { output, loss: null as number | null, yieldPct: null as number | null };
    return {
        output,
        loss: round(inputQty - output),
        yieldPct: Math.round((output / inputQty) * 10000) / 100,
    };
};

/** Local calendar date as YYYY-MM-DD. */
export const isoDate = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const shiftDays = (iso: string, days: number): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return isoDate(new Date(y, m - 1, d + days));
};

export const fmtQty = (v: number | null | undefined): string =>
    v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });

export const fmtMoney = (v: number | null | undefined): string =>
    v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
