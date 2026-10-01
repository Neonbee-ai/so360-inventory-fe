import type { ItemCategory } from '../types/inventory';

/** Where an inherited list comes from, for "Inherited from <name>". */
export interface InheritedList {
    ids: string[];
    from: string;
}

export interface InheritedAllocation {
    users: InheritedList | null;
    teams: InheritedList | null;
}

const nonEmpty = (v: unknown): string[] | null =>
    Array.isArray(v) && v.length ? v.filter((x): x is string => typeof x === 'string' && !!x) : null;

/** The category and its ancestors, nearest first. Stops on a cycle or a missing parent. */
export function categoryChain(categories: ItemCategory[], startId: string | null | undefined): ItemCategory[] {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const chain: ItemCategory[] = [];
    const seen = new Set<string>();
    let cur = startId ? byId.get(startId) : undefined;
    while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        chain.push(cur);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return chain;
}

/**
 * What a unit/tower would fall back to when its own list is empty: the
 * nearest category (starting at `startId`) with a non-empty list. Users and
 * teams resolve independently.
 */
export function inheritedAllocation(categories: ItemCategory[], startId: string | null | undefined): InheritedAllocation {
    const chain = categoryChain(categories, startId);
    const find = (key: 'assigned_user_ids' | 'assigned_team_ids'): InheritedList | null => {
        for (const c of chain) {
            const ids = nonEmpty(c.metadata?.[key]);
            if (ids && ids.length) return { ids, from: c.name };
        }
        return null;
    };
    return { users: find('assigned_user_ids'), teams: find('assigned_team_ids') };
}
