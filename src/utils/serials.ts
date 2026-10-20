/**
 * Serial tracking helpers (Sales-to-Service). Pure, no I/O.
 * Backend contract: Inventory BE /v1/inventory/serials (migration 061).
 */

export const SERIAL_TRACKING_FLAG = 'submodule:inventory:serial_tracking';

export type WarrantyStatus = 'not_sold' | 'no_warranty' | 'in_warranty' | 'out_of_warranty';

export interface SerialRecord {
    id: string;
    item_id: string;
    serial_number: string;
    status: string | null;
    warehouse_id?: string | null;
    sold_source_module?: string | null;
    sold_source_id?: string | null;
    sold_source_number?: string | null;
    customer_id?: string | null;
    customer_name?: string | null;
    sold_at?: string | null;
    warranty_until?: string | null;
    item?: { id: string; name: string; sku?: string | null; warranty_months?: number | null } | null;
    warranty_status?: WarrantyStatus;
}

/** Only an explicit `true` turns the feature on (a missing bridge fn means off). */
export function isSerialTrackingEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(SERIAL_TRACKING_FLAG) === true;
    } catch {
        return false;
    }
}

/** Result of checking a picked serial set against the line quantity. */
export function validateSerialSelection(selected: string[], quantity: number): string | null {
    const qty = Math.abs(Number(quantity) || 0);
    if (qty <= 0) return null;
    if (selected.length !== qty) {
        return `Select exactly ${qty} serial number${qty === 1 ? '' : 's'} (${selected.length} selected).`;
    }
    return null;
}

/** Toggle membership, keeping insertion order and never duplicating. */
export function toggleSerial(selected: string[], serial: string): string[] {
    return selected.includes(serial) ? selected.filter((s) => s !== serial) : [...selected, serial];
}

export const WARRANTY_LABELS: Record<WarrantyStatus, string> = {
    not_sold: 'Not sold',
    no_warranty: 'No warranty',
    in_warranty: 'In warranty',
    out_of_warranty: 'Out of warranty',
};

export const WARRANTY_TONES: Record<WarrantyStatus, 'neutral' | 'success' | 'danger'> = {
    not_sold: 'neutral',
    no_warranty: 'neutral',
    in_warranty: 'success',
    out_of_warranty: 'danger',
};

export const SERIAL_STATUS_LABELS: Record<string, string> = {
    in_stock: 'In stock',
    issued: 'Sold / issued',
    returned: 'Returned',
    retired: 'Retired',
    voided: 'Voided',
};

export const serialStatusLabel = (status?: string | null) =>
    (status && SERIAL_STATUS_LABELS[status]) || (status ? status.replace(/_/g, ' ') : '—');

/** KPI roll-up for a result set. */
export function summariseSerials(rows: SerialRecord[]) {
    return {
        total: rows.length,
        sold: rows.filter((r) => !!r.sold_at).length,
        inWarranty: rows.filter((r) => r.warranty_status === 'in_warranty').length,
        outOfWarranty: rows.filter((r) => r.warranty_status === 'out_of_warranty').length,
    };
}
