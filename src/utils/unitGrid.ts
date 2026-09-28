import type { AvailabilityUnit, UnitStatusCounts } from '../types/inventory';

export const DEFAULT_NUMBERING_PATTERN = '{floor}{stack:02}';
/** Guard against a typo generating tens of thousands of items in one click. */
export const MAX_UNITS_PER_RUN = 2000;

function toInt(v: unknown): number | null {
    if (typeof v === 'number') return Number.isInteger(v) ? v : null;
    // A blank form field is "not entered", not 0 — Number('') would read it as 0.
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isInteger(n) ? n : null;
}

/** Units a Generate run will attempt: floors (inclusive) × units per floor. 0 when the inputs are unusable. */
export function previewUnitCount(floorFrom: unknown, floorTo: unknown, unitsPerFloor: unknown): number {
    const from = toInt(floorFrom);
    const to = toInt(floorTo);
    const per = toInt(unitsPerFloor);
    if (from === null || to === null || per === null) return 0;
    if (to < from || per <= 0) return 0;
    return (to - from + 1) * per;
}

/** Stack labels 01..N for N units per floor. */
export function defaultStackLabels(unitsPerFloor: number): string[] {
    const n = Math.max(0, Math.min(99, Math.floor(unitsPerFloor || 0)));
    return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'));
}

/**
 * Render a unit number from a pattern. Supports `{floor}` / `{stack}` and a
 * zero-pad width, e.g. `{floor}{stack:02}` → floor 12, stack "3" → "1203".
 */
export function formatUnitNumber(pattern: string, floor: number, stack: string | number): string {
    const pat = pattern && pattern.trim() ? pattern : DEFAULT_NUMBERING_PATTERN;
    return pat.replace(/\{(floor|stack)(?::(\d+))?\}/g, (_m, key: string, width?: string) => {
        const raw = key === 'floor' ? String(floor) : String(stack);
        const w = width ? parseInt(width, 10) : 0;
        // A leading-zero stack like "03" collapses to "3" before padding so {stack:02} is stable.
        const base = key === 'stack' && /^\d+$/.test(raw) && w ? String(parseInt(raw, 10)) : raw;
        return w ? base.padStart(w, '0') : base;
    });
}

export type AvailabilityCounts = UnitStatusCounts;

const COUNTED_STATUSES = ['available', 'on_hold', 'sold', 'blocked', 'cancelled', 'unavailable'] as const;

export const emptyCounts = (): AvailabilityCounts => ({
    total: 0, available: 0, on_hold: 0, sold: 0, blocked: 0, cancelled: 0, unavailable: 0,
});

/** Read a counts object defensively: missing or non-numeric buckets are 0. */
export function toCounts(raw: unknown): AvailabilityCounts {
    const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const out = emptyCounts();
    out.total = Number(c.total) || 0;
    for (const k of COUNTED_STATUSES) out[k] = Number(c[k]) || 0;
    return out;
}

export function addCounts(a: AvailabilityCounts, b: AvailabilityCounts): AvailabilityCounts {
    const out = emptyCounts();
    out.total = a.total + b.total;
    for (const k of COUNTED_STATUSES) out[k] = a[k] + b[k];
    return out;
}

export function summarizeCounts(units: Pick<AvailabilityUnit, 'status'>[]): AvailabilityCounts {
    const out = emptyCounts();
    for (const u of units || []) {
        out.total += 1;
        if ((COUNTED_STATUSES as readonly string[]).includes(u.status)) out[u.status as (typeof COUNTED_STATUSES)[number]] += 1;
    }
    return out;
}

/** Sold share of all units, one decimal place; 0 for an empty project. */
export function percentSold(counts: Pick<AvailabilityCounts, 'total' | 'sold'>): number {
    if (!counts.total || counts.total <= 0) return 0;
    return Math.round((counts.sold / counts.total) * 1000) / 10;
}

/**
 * A unit price in its own currency, falling back to the org currency. An
 * unknown currency code still renders (code + number) rather than throwing.
 */
export function formatUnitMoney(
    amount: number | null | undefined,
    currency: string | null | undefined,
    orgCurrency: string | null | undefined,
    locale = 'en-US',
): string | null {
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return null;
    const code = (currency && currency.trim()) || (orgCurrency && orgCurrency.trim()) || '';
    const n = Number(amount);
    if (!code) return n.toLocaleString(locale);
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(n);
    } catch {
        return `${code} ${n.toLocaleString(locale)}`;
    }
}

export interface AvailabilityGrid {
    /** Highest floor first, as a building elevation reads. */
    floors: number[];
    /** Natural order: "2" before "10", "A" before "B". */
    stacks: string[];
    cells: Map<string, AvailabilityUnit>;
}

export const cellKey = (floor: number, stack: string) => `${floor}|${stack}`;

export function buildAvailabilityGrid(units: AvailabilityUnit[]): AvailabilityGrid {
    const floors = new Set<number>();
    const stacks = new Set<string>();
    const cells = new Map<string, AvailabilityUnit>();
    for (const u of units || []) {
        if (u == null || !Number.isFinite(Number(u.floor))) continue;
        const floor = Number(u.floor);
        const stack = String(u.stack ?? '');
        floors.add(floor);
        stacks.add(stack);
        const key = cellKey(floor, stack);
        if (!cells.has(key)) cells.set(key, u);
    }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return {
        floors: Array.from(floors).sort((a, b) => b - a),
        stacks: Array.from(stacks).sort(collator.compare),
        cells,
    };
}
