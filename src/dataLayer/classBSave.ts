import { inventoryService } from '../services/inventoryService';
import type { DlSaveResult } from './inventoryDataLayer';

/**
 * Class B save path (spec L2: "Who writes: the module").
 *
 * Custom-field values live in the item row's own `custom_fields` JSONB and are
 * written through the NATIVE Inventory API (PATCH /items/:id), never through
 * datasetsClient. Changed keys are merged over the current values so a
 * renderer that saves one field never drops the others.
 *
 * NOTE: this is separate from product-type `custom_attributes`, which keep
 * working unchanged through the native item edit form.
 */

export function currentClassBValues(record: Record<string, any> | null | undefined): Record<string, unknown> {
    const raw = record?.custom_fields;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

export function classBRecordView(record: Record<string, any> | null | undefined): Record<string, unknown> | null {
    if (!record) return null;
    return { ...record, custom_fields: currentClassBValues(record) };
}

export function recordVersion(record: Record<string, any> | null | undefined): number | string | null {
    if (!record) return null;
    return record.version ?? record.updated_at ?? null;
}

/** Inventory responses are sometimes `{ data: row }`, sometimes the bare row. */
function unwrap(res: any): Record<string, any> | null {
    if (!res || typeof res !== 'object') return null;
    return res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res;
}

export async function saveClassBCustomFields(
    recordId: string,
    current: Record<string, any> | null | undefined,
    changed: Record<string, unknown>,
): Promise<DlSaveResult> {
    const custom_fields = { ...currentClassBValues(current), ...changed };
    try {
        const saved = unwrap(await inventoryService.updateItem(recordId, { custom_fields }));
        const view = saved && saved.custom_fields !== undefined ? saved : { ...(current ?? {}), ...(saved ?? {}), custom_fields };
        return { ok: true, record: classBRecordView(view) ?? undefined };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Failed to save custom fields' };
    }
}
