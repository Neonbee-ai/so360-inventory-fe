import { useCallback, useMemo } from 'react';
import type { InventoryDataLayerState, InventoryRecordContext, DlSaveResult } from './inventoryDataLayer';
import { classBRecordView, classBVersionOf, recordVersion, saveClassBCustomFields } from './classBSave';

/** Row fields that move on a Class B save; merged into the host's record state. */
export interface ClassBRowRefresh {
    custom_fields_version?: number;
    updated_at?: string;
}

/**
 * Builds the entity + record + version context handed to every Shell renderer
 * on the item record page. `version` is the row's `custom_fields_version`
 * (else `updated_at`). On a successful save `onSaved` receives the saved Class B
 * values plus the refreshed version fields so the host page can merge them into
 * its own record state. When the response does not carry the new version the
 * host is asked to refetch (`onChanged`) so the next save never sends a stale
 * version.
 */
export function useInventoryRecordContext(
    dl: InventoryDataLayerState,
    recordId: string | undefined,
    record: Record<string, any> | null | undefined,
    opts: {
        canEdit: boolean;
        onChanged?: () => void;
        onSaved?: (classBValues: Record<string, unknown>, refresh: ClassBRowRefresh) => void;
    },
): InventoryRecordContext {
    const { canEdit, onChanged, onSaved } = opts;
    const onSave = useCallback(
        async (changed: Record<string, unknown>, version?: number | string | null): Promise<DlSaveResult> => {
            if (!recordId) return { ok: false, error: 'Record not loaded' };
            const res = await saveClassBCustomFields(recordId, record, changed, version ?? recordVersion(record));
            if (res.ok) {
                const saved = (res.record ?? {}) as Record<string, any>;
                const refresh: ClassBRowRefresh = {};
                const nextVersion = classBVersionOf(saved);
                if (nextVersion !== null) refresh.custom_fields_version = nextVersion;
                if (typeof saved.updated_at === 'string') refresh.updated_at = saved.updated_at;
                onSaved?.(((saved.custom_fields as Record<string, unknown>) ?? { ...changed }), refresh);
                const hadVersion = classBVersionOf(record) !== null;
                if (hadVersion && (nextVersion === null || nextVersion === classBVersionOf(record))) onChanged?.();
            }
            return res;
        },
        [recordId, record, onSaved, onChanged],
    );
    return useMemo(
        () => ({
            recordId: recordId ?? '',
            record: classBRecordView(record),
            version: recordVersion(record),
            onChanged,
            onSave,
            canEdit,
        }),
        [recordId, record, onChanged, onSave, canEdit],
    );
}
