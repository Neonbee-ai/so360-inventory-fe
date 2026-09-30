import { inventoryService } from '../services/inventoryService';
import type { DlSaveResult } from './inventoryDataLayer';

/**
 * Class B save path (spec L2: "Who writes: the module").
 *
 * Custom-field values live in the item row's own `custom_fields` JSONB and are
 * written through the NATIVE Inventory API (PATCH /items/:id), never through
 * datasetsClient or Core. Only the CHANGED keys are sent — the backend
 * shallow-merges them over the stored values (null removes a key) — together
 * with the row's `custom_fields_version` for optimistic concurrency.
 *
 * NOTE: this is separate from product-type `custom_attributes`, which keep
 * working unchanged through the native item edit form.
 */

export const VERSION_CONFLICT_CODE = 'DATASET_VERSION_CONFLICT';

export function currentClassBValues(record: Record<string, any> | null | undefined): Record<string, unknown> {
    const raw = record?.custom_fields;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

export function classBRecordView(record: Record<string, any> | null | undefined): Record<string, unknown> | null {
    if (!record) return null;
    return { ...record, custom_fields: currentClassBValues(record) };
}

/** Integer `custom_fields_version`, or null when the row does not carry it. */
export function classBVersionOf(record: Record<string, any> | null | undefined): number | null {
    const v = record?.custom_fields_version;
    return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

/**
 * Concurrency token handed to the Shell `version` prop: the row's
 * `custom_fields_version`, falling back to `updated_at` when the column is absent.
 */
export function recordVersion(record: Record<string, any> | null | undefined): number | string | null {
    if (!record) return null;
    return classBVersionOf(record) ?? record.updated_at ?? null;
}

/**
 * The version to put in the PATCH body. Only an integer row version is sent —
 * an `updated_at` fallback is not a `custom_fields_version`.
 */
export function wireVersion(version: number | string | null | undefined): number | undefined {
    if (typeof version === 'number' && Number.isInteger(version)) return version;
    if (typeof version === 'string' && /^\d+$/.test(version)) return Number(version);
    return undefined;
}

function errorCodeOf(e: any): string | undefined {
    const b = e?.body ?? e?.response?.data;
    const code = e?.code ?? b?.code ?? b?.error;
    return typeof code === 'string' ? code : undefined;
}

function statusOf(e: any): number | undefined {
    const s = e?.status ?? e?.statusCode ?? e?.response?.status;
    return typeof s === 'number' ? s : undefined;
}

export function isVersionConflict(e: unknown): boolean {
    return statusOf(e) === 409 || errorCodeOf(e) === VERSION_CONFLICT_CODE;
}

function messageOf(e: any): string {
    const b = e?.body ?? e?.response?.data;
    const bm = Array.isArray(b?.message) ? b.message.join('; ') : b?.message;
    if (typeof bm === 'string' && bm.trim()) return bm;
    if (typeof e?.message === 'string' && e.message.trim()) return e.message;
    return 'Failed to save custom fields';
}

/** Inventory responses are sometimes `{ data: row }`, sometimes the bare row. */
function unwrap(res: any): Record<string, any> | null {
    if (!res || typeof res !== 'object') return null;
    return res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res;
}

/** Local mirror of the backend merge (shallow; null removes the key). */
function mergeLocal(current: Record<string, unknown>, changed: Record<string, unknown>): Record<string, unknown> {
    const out = { ...current };
    Object.entries(changed).forEach(([k, v]) => {
        if (v === null) delete out[k];
        else out[k] = v;
    });
    return out;
}

export async function saveClassBCustomFields(
    recordId: string,
    current: Record<string, any> | null | undefined,
    changed: Record<string, unknown>,
    version?: number | string | null,
): Promise<DlSaveResult> {
    const v = wireVersion(version !== undefined ? version : recordVersion(current));
    const body: Record<string, unknown> = { custom_fields: { ...changed } };
    if (v !== undefined) body.version = v;
    try {
        const saved: any = unwrap(await inventoryService.updateItem(recordId, body));
        const hasSaved = saved && typeof saved === 'object' && saved.custom_fields !== undefined;
        const view = hasSaved
            ? classBRecordView(saved)
            : {
                ...(current ?? {}),
                ...(saved && typeof saved === 'object' ? saved : {}),
                custom_fields: mergeLocal(currentClassBValues(current), changed),
            };
        return { ok: true, record: view ?? undefined };
    } catch (e: any) {
        if (isVersionConflict(e)) return { ok: false, conflict: true, error: messageOf(e) };
        return { ok: false, error: messageOf(e) };
    }
}
