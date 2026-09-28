import type { AvailabilityUnit } from '../types/inventory';

export const DEFAULT_NUMBERING_PATTERN = '{floor}{stack:02}';
/** Guard against a typo generating tens of thousands of items in one click. */
export const MAX_UNITS_PER_RUN = 2000;

function toInt(v: unknown): number | null {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
    return Number.isFinite(n) && Number.isInteger(n) ? n : null;
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

export interface AvailabilityCounts {
    total: number;
    available: number;
    on_hold: number;
    sold: number;
}

export function summarizeCounts(units: Pick<AvailabilityUnit, 'status'>[]): AvailabilityCounts {
    const out: AvailabilityCounts = { total: 0, available: 0, on_hold: 0, sold: 0 };
    for (const u of units || []) {
        out.total += 1;
        if (u.status === 'available') out.available += 1;
        else if (u.status === 'on_hold') out.on_hold += 1;
        else if (u.status === 'sold') out.sold += 1;
    }
    return out;
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
