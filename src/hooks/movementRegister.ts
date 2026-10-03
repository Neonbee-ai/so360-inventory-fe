/**
 * Stock Movement Register helpers: conversions as their own movement type and
 * the "loss filter" set by tapping a row on the Losses tab.
 *
 * The movements API has no reason/category filter and stores conversions as
 * plain inbound/outbound rows, so those filters run client-side over one
 * enlarged page (CLIENT_FILTER_LIMIT rows).
 */
import type { LossGroupBy, LossReason } from '../services/inventoryService';

/** Pseudo movement type used by the register for conversion rows. */
export const CONVERSION_TYPE = 'conversion';
/** reason_code inv-be stamps on every conversion movement. */
export const CONVERSION_REASON = 'CONVERSION';
/** source_label prefix inv-be stamps on every conversion movement. */
export const CONVERSION_SOURCE_PREFIX = 'stock_conversion:';
/** Count lines without a reason are summarised under this key. */
export const UNSPECIFIED_REASON = 'UNSPECIFIED';
/** Page size requested when rows are filtered client-side (server max). */
export const CLIENT_FILTER_LIMIT = 500;

interface MovementLike {
    item_id?: string | null;
    variant_id?: string | null;
    quantity?: number | string | null;
    reason_code?: string | null;
    source_label?: string | null;
    movement_type?: string | null;
    type?: string | null;
}

export const isConversion = (m: MovementLike): boolean =>
    String(m.reason_code ?? '').toUpperCase() === CONVERSION_REASON
    || String(m.source_label ?? '').startsWith(CONVERSION_SOURCE_PREFIX);

/** Movement type shown in the register: conversions get their own type. */
export const movementTypeOf = (m: MovementLike): string =>
    isConversion(m) ? CONVERSION_TYPE : String(m.movement_type || m.type || '');

/** Filter set by tapping a Losses-tab row. */
export interface LossFilter {
    groupBy: LossGroupBy;
    key: string;
    label: string;
    from: string;
    to: string;
}

const GROUPS: LossGroupBy[] = ['reason', 'item', 'category'];

/** Reads the loss filter from the register URL (`loss_by`, `loss_key`, …). */
export const parseLossFilter = (params: URLSearchParams): LossFilter | null => {
    const groupBy = params.get('loss_by') as LossGroupBy | null;
    const key = params.get('loss_key');
    if (!groupBy || !GROUPS.includes(groupBy) || !key) return null;
    return {
        groupBy,
        key,
        label: params.get('loss_label') || key,
        from: params.get('from') || '',
        to: params.get('to') || '',
    };
};

/** URL params that carry a loss filter (empty strings clear them). */
export const lossFilterParams = (lf: LossFilter | null): Record<string, string> => ({
    loss_by: lf?.groupBy ?? '',
    loss_key: lf?.key ?? '',
    loss_label: lf?.label ?? '',
    from: lf?.from ?? '',
    to: lf?.to ?? '',
});

/**
 * Filters sent to the movements API. A conversion type or a loss filter is
 * resolved client-side, so the server gets the widest page instead.
 */
export const serverFilters = (
    filters: Record<string, string>,
    lossFilter: LossFilter | null,
): Record<string, string | number> => {
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(filters)) if (v) out[k] = v;
    const clientSide = out.movement_type === CONVERSION_TYPE || !!lossFilter;
    if (out.movement_type === CONVERSION_TYPE) delete out.movement_type;
    if (lossFilter) {
        if (lossFilter.from) out.date_from = lossFilter.from;
        if (lossFilter.to) out.date_to = lossFilter.to;
    }
    if (clientSide) out.limit = CLIENT_FILTER_LIMIT;
    return out;
};

/** True when a movement belongs to the tapped loss row. Only stock going out counts. */
export const matchesLossFilter = (
    m: MovementLike,
    lf: LossFilter,
    reasons: LossReason[],
): boolean => {
    if (!(Number(m.quantity) < 0)) return false;
    const code = m.reason_code || '';
    // Loss item keys are stock rows: the variant id when there is one.
    if (lf.groupBy === 'item') return m.variant_id === lf.key || m.item_id === lf.key;
    if (lf.groupBy === 'reason') {
        return lf.key === UNSPECIFIED_REASON ? !code : code === lf.key;
    }
    const reason = reasons.find((r) => r.code === code);
    if (reason) return (reason.category || 'other') === lf.key;
    // Uncatalogued count reasons are summarised as "other".
    return lf.key === 'other' && String(m.source_label ?? '').startsWith('stock_count:');
};

/** Applies the client-side parts of the register filters. */
export const applyClientFilters = <T extends MovementLike>(
    rows: T[],
    movementType: string,
    lossFilter: LossFilter | null,
    reasons: LossReason[],
): T[] => rows.filter((m) =>
    (movementType !== CONVERSION_TYPE || isConversion(m))
    && (!lossFilter || matchesLossFilter(m, lossFilter, reasons)));
