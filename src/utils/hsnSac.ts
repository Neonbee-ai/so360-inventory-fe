/**
 * HSN/SAC master helpers for the item form (Pulse 369f57ed). Pure, no I/O.
 * Backend contract: Inventory BE GET /v1/inventory/hsn-sac (proxy to Accounting)
 * and items.hsn_sac_kind (migration 069).
 */

export const HSN_SAC_MASTER_FLAG = 'submodule:accounting:hsn_sac_master';

export type HsnSacKind = 'goods' | 'service';

/** Only an explicit `true` turns the picker on; a missing bridge fn means off (free text stays). */
export function isHsnSacMasterEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(HSN_SAC_MASTER_FLAG) === true;
    } catch {
        return false;
    }
}

export const HSN_KIND_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '', label: 'Auto (from product type)' },
    { value: 'goods', label: 'Goods (HSN)' },
    { value: 'service', label: 'Service (SAC)' },
];

/** Kind the picker searches: the explicit choice, else service types search SAC and everything else HSN. */
export function effectiveHsnKind(kind: string | null | undefined, itemType: string | null | undefined): HsnSacKind {
    if (kind === 'goods' || kind === 'service') return kind;
    return itemType === 'service' ? 'service' : 'goods';
}

export function hsnKindLabel(kind: string | null | undefined): string {
    return kind === 'goods' ? 'Goods (HSN)' : kind === 'service' ? 'Service (SAC)' : '';
}

/** The server saved the item but could not check the code against the master. */
export function hsnValidationWarning(saved: any): string | null {
    const w = saved?.hsn_validation_warning;
    return typeof w === 'string' && w.trim() ? w : null;
}

export interface HsnSacRow {
    code: string;
    kind: HsnSacKind;
    description: string;
    is_selectable?: boolean;
    is_active?: boolean;
}
