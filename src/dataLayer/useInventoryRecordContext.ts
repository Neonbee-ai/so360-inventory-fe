import { useCallback, useMemo } from 'react';
import type { InventoryDataLayerState, InventoryRecordContext, DlSaveResult } from './inventoryDataLayer';
import { classBRecordView, recordVersion, saveClassBCustomFields } from './classBSave';

/**
 * Builds the entity + record + version context handed to every Shell renderer
 * on the item record page. `onSaved` receives the saved Class B values so the
 * host page can merge them into its own record state.
 */
export function useInventoryRecordContext(
    dl: InventoryDataLayerState,
    recordId: string | undefined,
    record: Record<string, any> | null | undefined,
    opts: { canEdit: boolean; onChanged?: () => void; onSaved?: (classBValues: Record<string, unknown>) => void },
): InventoryRecordContext {
    const { canEdit, onChanged, onSaved } = opts;
    const onSave = useCallback(
        async (changed: Record<string, unknown>): Promise<DlSaveResult> => {
            if (!recordId) return { ok: false, error: 'Record not loaded' };
            const res = await saveClassBCustomFields(recordId, record, changed);
            if (res.ok) onSaved?.(((res.record?.custom_fields as Record<string, unknown>) ?? { ...changed }));
            return res;
        },
        [recordId, record, onSaved],
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
