/**
 * Canonical product dimension order (Pulse f2493088): Length → Breadth → Width,
 * then Height / Depth as their own measurements (never relabelled as Width).
 * Same rule as the storefront API, so Inventory and the StoreFront read alike.
 */

export type DimensionRole = 'length' | 'breadth' | 'width' | 'height' | 'depth';

const ROLE_RANK: Record<DimensionRole, number> = { length: 0, breadth: 1, width: 2, height: 3, depth: 4 };
const ROLE_ALIASES: Record<string, DimensionRole> = {
    length: 'length', len: 'length', l: 'length',
    breadth: 'breadth', b: 'breadth',
    width: 'width', wide: 'width', w: 'width',
    height: 'height', ht: 'height', h: 'height',
    depth: 'depth',
};
const NAME_NOISE = new Set([
    'mm', 'cm', 'm', 'in', 'inch', 'inches', 'ft', 'feet', 'metre', 'meter', 'metres', 'meters',
    'product', 'item', 'overall', 'total', 'outer', 'external',
]);

/** Which dimension a field name / label means, or null ("Seat Height" is not Height). */
export function dimensionRole(...names: Array<string | null | undefined>): DimensionRole | null {
    for (const name of names) {
        if (!name) continue;
        const tokens = name
            .replace(/\([^)]*\)/g, ' ')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .toLowerCase()
            .split(/[^a-z]+/)
            .filter(t => t && !NAME_NOISE.has(t));
        if (tokens.length === 1 && ROLE_ALIASES[tokens[0]]) return ROLE_ALIASES[tokens[0]];
    }
    return null;
}

/** Dimensions come first in canonical order, then the non-dimension items in their given order. */
export function orderWithDimensions<T>(items: T[], roleOf: (item: T) => DimensionRole | null): T[] {
    if (!items.some(i => roleOf(i) !== null)) return items;
    const dims = items.filter(i => roleOf(i) !== null).sort((a, b) => ROLE_RANK[roleOf(a)!] - ROLE_RANK[roleOf(b)!]);
    const rest = items.filter(i => roleOf(i) === null);
    return [...dims, ...rest];
}

interface OrderableAttribute { field_name: string; label?: string | null; sort_order?: number | null }

/**
 * Product-type attributes in display order: the configured sort_order, with the
 * dimension fields always reading Length, Breadth, Width (then Height). The
 * stable field_name decides the role; the label only when the key says nothing.
 * Returns a new array — never mutates the input.
 */
export function orderAttributesForDisplay<T extends OrderableAttribute>(attrs: T[] | null | undefined): T[] {
    if (!attrs) return [];
    const sorted = [...attrs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return orderWithDimensions(sorted, a => dimensionRole(a.field_name) ?? dimensionRole(a.label));
}
