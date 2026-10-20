import React, { useEffect, useState } from 'react';
import { Alert, Checkbox, Skeleton } from '@so360/design-system';
import { serialService } from '../../services/serialService';
import { toggleSerial, validateSerialSelection, type SerialRecord } from '../../utils/serials';

interface SerialPickerProps {
    itemId: string;
    /** Units on the sales order / delivery line; the pick must match it exactly. */
    quantity: number;
    selected: string[];
    onChange: (serials: string[]) => void;
    /** Optional narrowing to the dispatching warehouse. */
    warehouseId?: string;
}

/** Pick the in-stock serial numbers that leave on a sales order / delivery line. */
export const SerialPicker = ({ itemId, quantity, selected, onChange, warehouseId }: SerialPickerProps) => {
    const [rows, setRows] = useState<SerialRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        setLoading(true);
        setError(null);
        serialService.availableForItem(itemId, 50)
            .then((r) => { if (live) setRows(r); })
            .catch((e: any) => { if (live) setError(e?.message || 'Failed to load serial numbers'); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [itemId]);

    const visible = warehouseId ? rows.filter((r) => !r.warehouse_id || r.warehouse_id === warehouseId) : rows;
    const problem = validateSerialSelection(selected, quantity);

    if (loading) return <Skeleton variant="rect" />;
    if (error) return <Alert variant="error">{error}</Alert>;
    if (visible.length === 0) return <Alert variant="warning">No in-stock serial numbers for this item.</Alert>;

    return (
        <div className="flex flex-col gap-nb-2" data-testid="serial-picker">
            <p className="text-nb-caption text-fg-subtle">
                Serial numbers ({selected.length} of {Math.abs(Number(quantity) || 0)} selected)
            </p>
            <div className="flex max-h-48 flex-col gap-nb-1 overflow-y-auto">
                {visible.map((r) => (
                    <Checkbox
                        key={r.id}
                        name={`serial-${r.id}`}
                        label={r.serial_number}
                        aria-label={`Serial ${r.serial_number}`}
                        checked={selected.includes(r.serial_number)}
                        onChange={() => onChange(toggleSerial(selected, r.serial_number))}
                    />
                ))}
            </div>
            {problem && <p role="alert" data-testid="serial-picker-error" className="text-nb-caption text-danger">{problem}</p>}
        </div>
    );
};

export default SerialPicker;
