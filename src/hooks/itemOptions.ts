import type {
    ItemOptionValue,
    MeasurementDef,
    OptionAppliesTo,
    OptionGroup,
} from '../services/inventoryService';

/** Option groups and capture fields (Settings tab + item Options tab). */
export const ITEM_OPTIONS_FLAG = 'submodule:dailystore:item_options';
/** Capture fields (measurements taken at the counter) ride on top of options. */
export const CAPTURE_FIELDS_FLAG = 'action:dailystore:pos:captured_measurements';

export const isItemOptionsEnabled = (shell: any): boolean =>
    shell?.isFeatureEnabled?.(ITEM_OPTIONS_FLAG) === true;

export const isCaptureFieldsEnabled = (shell: any): boolean =>
    shell?.isFeatureEnabled?.(CAPTURE_FIELDS_FLAG) === true;

export interface NamedRef {
    id: string;
    name: string;
}

export const emptyApplies = (): OptionAppliesTo => ({ item_ids: [], category_ids: [] });

export const emptyOption = (sort = 0): ItemOptionValue => ({
    name: '',
    price_delta: 0,
    price_mode: 'fixed',
    is_default: false,
    sort_order: sort,
    is_active: true,
});

export const emptyGroup = (): OptionGroup => ({
    name: '',
    selection: 'single',
    is_required: false,
    min_select: 0,
    max_select: 1,
    applies_to: emptyApplies(),
    sort_order: 0,
    is_active: true,
    options: [emptyOption()],
});

export const emptyDef = (): MeasurementDef => ({
    key: '',
    label: '',
    unit: '',
    applies_to: emptyApplies(),
    is_billing_basis: false,
    sort_order: 0,
});

/** Turns a label into a stable machine key ("Gross weight" → "gross_weight"). */
export function toKey(label: string): string {
    return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Returns the first problem with a group draft, or null. */
export function validateGroup(g: OptionGroup): string | null {
    if (!g.name.trim()) return 'Group name is required.';
    const opts = g.options.filter((o) => o.name.trim());
    if (!opts.length) return 'Add at least one value.';
    if (g.max_select != null && g.max_select < Math.max(1, g.min_select)) return 'Max picks must be at least min picks.';
    if (g.selection === 'single' && opts.filter((o) => o.is_default).length > 1) return 'Only one default is allowed for a single-pick group.';
    return null;
}

/**
 * The body sent on save: single-pick groups pick exactly one (min 1 when
 * required), unnamed values are dropped and values are re-ordered.
 */
export function groupBody(g: OptionGroup): OptionGroup {
    return {
        ...g,
        name: g.name.trim(),
        min_select: g.selection === 'single' ? (g.is_required ? 1 : 0) : Number(g.min_select) || 0,
        max_select: g.selection === 'single' ? 1 : g.max_select,
        applies_to: g.applies_to ?? emptyApplies(),
        options: g.options
            .filter((o) => o.name.trim())
            .map((o, idx) => ({
                name: o.name.trim(),
                price_delta: Number(o.price_delta) || 0,
                price_mode: o.price_mode,
                is_default: o.is_default,
                sort_order: idx,
                is_active: o.is_active,
            })),
    };
}

/** In a single-pick group the default is exclusive. */
export function setOptionPatch(g: OptionGroup, i: number, patch: Partial<ItemOptionValue>): OptionGroup {
    let options = g.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    if (patch.is_default && g.selection === 'single') {
        options = options.map((o, idx) => (idx === i ? o : { ...o, is_default: false }));
    }
    return { ...g, options };
}

export function appliesSummary(a: OptionAppliesTo | undefined, categories: NamedRef[]): string {
    if (!a || (!a.item_ids?.length && !a.category_ids?.length)) return 'All items';
    const parts = (a.category_ids || []).map((id) => categories.find((c) => c.id === id)?.name || 'Category');
    if (a.item_ids?.length) parts.push(`${a.item_ids.length} item${a.item_ids.length === 1 ? '' : 's'}`);
    return parts.join(', ');
}

export function picksSummary(g: OptionGroup): string {
    const req = g.is_required ? 'required' : 'optional';
    if (g.selection === 'single') return `pick 1 · ${req}`;
    return `${g.min_select}–${g.max_select ?? 'any'} · ${req}`;
}

/**
 * How a group reaches an item:
 * - 'item'     — the item is listed in applies_to.item_ids (can be detached)
 * - 'category' — through the item's category
 * - 'all'      — the group has no scope, so it applies to every item
 * - null       — it does not apply (can be attached)
 */
export type GroupLink = 'item' | 'category' | 'all' | null;

export function groupLinkForItem(g: OptionGroup, itemId: string, categoryId?: string | null): GroupLink {
    const a = g.applies_to;
    const itemIds = a?.item_ids ?? [];
    const catIds = a?.category_ids ?? [];
    if (!itemIds.length && !catIds.length) return 'all';
    if (itemIds.includes(itemId)) return 'item';
    if (categoryId && catIds.includes(categoryId)) return 'category';
    return null;
}

/** applies_to after attaching the item to the group. */
export function attachItem(a: OptionAppliesTo | undefined, itemId: string): OptionAppliesTo {
    const base = a ?? emptyApplies();
    const item_ids = base.item_ids ?? [];
    return { item_ids: item_ids.includes(itemId) ? item_ids : [...item_ids, itemId], category_ids: base.category_ids ?? [] };
}

/**
 * An empty scope means "every item", so removing the last scoped item would
 * widen the group to the whole catalog instead of removing it here.
 */
export function detachWouldWiden(a: OptionAppliesTo | undefined, itemId: string): boolean {
    const next = detachItem(a, itemId);
    return !next.item_ids.length && !next.category_ids.length;
}

/** applies_to after detaching the item from the group. */
export function detachItem(a: OptionAppliesTo | undefined, itemId: string): OptionAppliesTo {
    const base = a ?? emptyApplies();
    return { item_ids: (base.item_ids ?? []).filter((x) => x !== itemId), category_ids: base.category_ids ?? [] };
}
