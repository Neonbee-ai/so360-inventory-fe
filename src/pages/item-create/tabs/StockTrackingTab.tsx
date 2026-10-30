import React from 'react';
import { Select, TextField, FieldGrid, Checkbox } from '@so360/design-system';
import FormSection from '../components/FormSection';

interface Warehouse {
    id: string;
    name: string;
}

interface StockTrackingTabProps {
    min_stock_threshold: string;
    reorder_level: string;
    is_batch_tracked: boolean;
    is_serial_tracked: boolean;
    is_active: boolean;
    updateField: (field: string, value: any) => void;
    default_warehouse_id?: string;
    warehouses?: Warehouse[];
    is_online_visible?: boolean;
}

const StockTrackingTab: React.FC<StockTrackingTabProps> = ({
    min_stock_threshold, reorder_level, is_batch_tracked, is_serial_tracked, is_active,
    updateField, default_warehouse_id, warehouses, is_online_visible,
}) => {
    return (
        <div className="space-y-nb-6">
            <FormSection title="Stock Thresholds" description="Set alerts and automatic reorder levels">
                <FieldGrid columns={2}>
                    <TextField
                        label="Min Stock Threshold"
                        name="min_stock_threshold"
                        type="number"
                        min="0"
                        value={min_stock_threshold}
                        onChange={e => updateField('min_stock_threshold', e.target.value)}
                        placeholder="0"
                        hint="Alert when stock drops below this level"
                    />
                    <TextField
                        label="Reorder Level"
                        name="reorder_level"
                        type="number"
                        min="0"
                        value={reorder_level}
                        onChange={e => updateField('reorder_level', e.target.value)}
                        placeholder="0"
                        hint="Trigger reorder when stock reaches this level"
                    />
                </FieldGrid>
            </FormSection>

            <FormSection title="Tracking Options">
                <div className="flex flex-col gap-nb-3 p-nb-4 bg-surface-raised border border-line rounded-nb-md">
                    <Checkbox name="is_batch_tracked" label="Batch Tracked" description="Track items by batch/lot numbers for expiry and recalls" checked={is_batch_tracked} onChange={e => updateField('is_batch_tracked', e.target.checked)} />
                    <Checkbox name="is_serial_tracked" label="Serial Tracked" description="Track each individual item by unique serial number" checked={is_serial_tracked} onChange={e => updateField('is_serial_tracked', e.target.checked)} />
                </div>
            </FormSection>

            {/* Default Warehouse */}
            {warehouses && warehouses.length > 0 && (
                <FormSection title="Default Warehouse" description="Assign the primary warehouse for this item">
                    <Select
                        label="Default Warehouse"
                        name="default_warehouse_id"
                        value={default_warehouse_id || ''}
                        onChange={(e: any) => updateField('default_warehouse_id', e.target.value)}
                        placeholder="Auto-assign (first active warehouse)"
                        options={[{ value: '', label: 'Auto-assign (first active warehouse)' }, ...warehouses.map(w => ({ value: w.id, label: w.name }))]}
                    />
                </FormSection>
            )}

            <FormSection title="Status & Visibility">
                <div className="flex flex-col gap-nb-3 p-nb-4 bg-surface-raised border border-line rounded-nb-md">
                    <Checkbox name="is_active" label="Active" description="Inactive items are hidden from selection lists and ordering" checked={is_active} onChange={e => updateField('is_active', e.target.checked)} />
                    <Checkbox name="is_online_visible" label="Online Visible" description="Show this product in the Daily Store online catalog (requires Active status)" checked={is_online_visible || false} onChange={e => updateField('is_online_visible', e.target.checked)} />
                </div>
            </FormSection>
        </div>
    );
};

export default StockTrackingTab;
