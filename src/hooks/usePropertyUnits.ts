import { useShellBridge } from '@so360/shell-context';

/** Feature flag that turns categories into real-estate Projects/Towers and items into Units. */
export const PROPERTY_UNITS_FLAG = 'submodule:inventory:property_units';

export interface PropertyUnitLabels {
    category: string;
    categories: string;
    subcategory: string;
    item: string;
    items: string;
}

/**
 * The one place inventory vocabulary switches for real estate. Keep new
 * words here rather than sprinkling flag checks through pages.
 */
export const PROPERTY_UNIT_LABELS: PropertyUnitLabels = {
    category: 'Project',
    categories: 'Projects',
    subcategory: 'Tower',
    item: 'Unit',
    items: 'Units',
};

export const DEFAULT_LABELS: PropertyUnitLabels = {
    category: 'Category',
    categories: 'Categories',
    subcategory: 'Subcategory',
    item: 'Item',
    items: 'Items',
};

/**
 * Only an explicit `true` turns the feature on: page tests mock the bridge
 * without `isFeatureEnabled`, and a missing function must mean "off".
 */
export function isPropertyUnitsEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(PROPERTY_UNITS_FLAG) === true;
    } catch {
        return false;
    }
}

/** Action flag for per-tower / per-unit agent & team allocation overrides. */
export const UNIT_ALLOCATION_FLAG = 'action:crm:unit_allocation';

/** Same explicit-`true` rule as the property_units flag. */
export function isUnitAllocationEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(UNIT_ALLOCATION_FLAG) === true;
    } catch {
        return false;
    }
}

export function usePropertyUnits(): { enabled: boolean; labels: PropertyUnitLabels } {
    const shell = useShellBridge() as any;
    const enabled = isPropertyUnitsEnabled(shell);
    return { enabled, labels: enabled ? PROPERTY_UNIT_LABELS : DEFAULT_LABELS };
}
