/**
 * Warehouse location hierarchy (bd9e7544): Warehouse → Zone → (Aisle) → Rack.
 * Mirrors so360-inventory-be src/warehouses/location-hierarchy.ts, which is
 * what actually rejects an invalid parent.
 */
export type LocationType = 'general' | 'zone' | 'aisle' | 'rack';

export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
    { value: 'general', label: 'General location' },
    { value: 'zone', label: 'Zone' },
    { value: 'aisle', label: 'Aisle' },
    { value: 'rack', label: 'Rack' },
];

export const ALLOWED_PARENTS: Record<LocationType, LocationType[]> = {
    general: [],
    zone: [],
    aisle: ['zone'],
    rack: ['zone', 'aisle'],
};

export interface HierarchyLocation {
    id: string;
    name: string;
    code?: string;
    location_type?: string | null;
    parent_location_id?: string | null;
    is_active?: boolean | null;
}

export const typeOf = (loc: Pick<HierarchyLocation, 'location_type'>): LocationType =>
    (loc.location_type as LocationType) || 'general';

export const locationTypeLabel = (type: LocationType): string =>
    LOCATION_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? 'General location';

/** Active locations of an allowed parent type, excluding the location itself and its descendants. */
export function parentOptions(
    type: LocationType,
    locations: HierarchyLocation[],
    selfId?: string,
): { value: string; label: string }[] {
    const allowed = ALLOWED_PARENTS[type];
    if (allowed.length === 0) return [];
    const blocked = selfId ? descendantIds(selfId, locations) : new Set<string>();
    if (selfId) blocked.add(selfId);
    const byId = new Map(locations.map((l) => [l.id, l]));
    return locations
        .filter((l) => l.is_active !== false && allowed.includes(typeOf(l)) && !blocked.has(l.id))
        .map((l) => ({ value: l.id, label: locationPath(l.id, byId) }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function descendantIds(id: string, locations: HierarchyLocation[]): Set<string> {
    const out = new Set<string>();
    const queue = [id];
    while (queue.length) {
        const cur = queue.shift()!;
        for (const l of locations) {
            if (l.parent_location_id === cur && !out.has(l.id) && l.id !== id) {
                out.add(l.id);
                queue.push(l.id);
            }
        }
    }
    return out;
}

/** "Zone A / Aisle 1 / Rack 3"; stops on cycles or missing parents. */
export function locationPath(id: string, byId: Map<string, HierarchyLocation>): string {
    const parts: string[] = [];
    const seen = new Set<string>();
    let curId: string | null | undefined = id;
    while (curId && !seen.has(curId)) {
        const cur = byId.get(curId);
        if (!cur) break;
        seen.add(curId);
        parts.unshift(cur.name);
        curId = cur.parent_location_id;
    }
    return parts.join(' / ');
}

/** Client-side mirror of the backend parent rule; null when valid. */
export function parentError(type: LocationType, parentId: string | null | undefined): string | null {
    if (type === 'rack' && !parentId) return 'A rack must belong to a zone or aisle.';
    return null;
}

/** Parents first, children right after them, depth for indenting. */
export function sortByHierarchy<T extends HierarchyLocation>(locations: T[]): { loc: T; depth: number }[] {
    const ids = new Set(locations.map((l) => l.id));
    const kids = new Map<string | null, T[]>();
    for (const l of locations) {
        const p = l.parent_location_id && ids.has(l.parent_location_id) ? l.parent_location_id : null;
        kids.set(p, [...(kids.get(p) ?? []), l]);
    }
    const out: { loc: T; depth: number }[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
        for (const l of kids.get(parent) ?? []) {
            if (seen.has(l.id)) continue;
            seen.add(l.id);
            out.push({ loc: l, depth });
            walk(l.id, depth + 1);
        }
    };
    walk(null, 0);
    // Anything only reachable through a cycle is still listed.
    for (const l of locations) if (!seen.has(l.id)) out.push({ loc: l, depth: 0 });
    return out;
}
