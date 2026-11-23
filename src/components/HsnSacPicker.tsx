import React, { useCallback, useRef, useState } from 'react';
import { Combobox, TextField, type ComboboxOption } from '@so360/design-system';
import { inventoryService } from '../services/inventoryService';
import { effectiveHsnKind, type HsnSacRow } from '../utils/hsnSac';

interface HsnSacPickerProps {
    value: string;
    /** Explicit goods/service choice; empty = derive from the item type. */
    kind: string;
    itemType: string;
    onChange: (code: string, row: HsnSacRow | null) => void;
    error?: string;
}

/**
 * Searchable HSN/SAC picker (code + description) filtered by kind. Falls back to
 * the plain text field when the master is unavailable (Accounting down, no access).
 */
const HsnSacPicker: React.FC<HsnSacPickerProps> = ({ value, kind, itemType, onChange, error }) => {
    const [unavailable, setUnavailable] = useState(false);
    const rows = useRef(new Map<string, HsnSacRow>());
    const searchKind = effectiveHsnKind(kind, itemType);
    const label = searchKind === 'service' ? 'SAC Code' : 'HSN Code';

    const loadOptions = useCallback(async (term: string): Promise<ComboboxOption[]> => {
        try {
            const res = await inventoryService.searchHsnSac({ q: term.trim(), kind: searchKind, page_size: 20 });
            if (res?.unavailable) {
                setUnavailable(true);
                return [];
            }
            const list: HsnSacRow[] = (res?.data ?? []).filter((r: HsnSacRow) => r.is_selectable !== false && r.is_active !== false);
            rows.current = new Map(list.map((r) => [r.code, r]));
            return list.map((r) => ({ value: r.code, label: r.code, description: r.description }));
        } catch {
            setUnavailable(true);
            return [];
        }
    }, [searchKind]);

    if (unavailable) {
        return (
            <TextField
                label="HSN / SAC Code"
                name="hsn_code"
                value={value}
                onChange={(e: any) => onChange(e.target.value, null)}
                placeholder="e.g. 8471"
                hint="HSN/SAC master is unavailable right now; type the code."
                error={error}
            />
        );
    }

    return (
        <Combobox
            label={label}
            name="hsn_code"
            value={value || null}
            options={value ? [{ value, label: value }] : []}
            loadOptions={loadOptions}
            debounceMs={300}
            clearable
            placeholder={searchKind === 'service' ? 'Search SAC by code or description' : 'Search HSN by code or description'}
            emptyText={`No active ${searchKind === 'service' ? 'SAC' : 'HSN'} codes found`}
            error={error}
            onChange={(code: string | null) => onChange(code ?? '', code ? rows.current.get(code) ?? null : null)}
        />
    );
};

export default HsnSacPicker;
