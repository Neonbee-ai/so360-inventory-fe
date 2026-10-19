import React from 'react';
import { Select, TextField } from '@so360/design-system';
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-nb-4">
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
                </div>
            </FormSection>

            <FormSection title="Tracking Options">
                <div className="flex flex-col gap-nb-3 p-nb-4 bg-surface-raised border border-line rounded-nb-md">
                    <label className="flex items-center gap-nb-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_batch_tracked}
                            onChange={e => updateField('is_batch_tracked', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <div>
                            <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">Batch Tracked</span>
                            <p className="text-xs text-fg-subtle">Track items by batch/lot numbers for expiry and recalls</p>
                        </div>
                    </label>
                    <label className="flex items-center gap-nb-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_serial_tracked}
                            onChange={e => updateField('is_serial_tracked', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <div>
                            <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">Serial Tracked</span>
                            <p className="text-xs text-fg-subtle">Track each individual item by unique serial number</p>
                        </div>
                    </label>
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
                    <label className="flex items-center gap-nb-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_active}
                            onChange={e => updateField('is_active', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <div>
                            <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">Active</span>
                            <p className="text-xs text-fg-subtle">Inactive items are hidden from selection lists and ordering</p>
                        </div>
                    </label>
                    <label className="flex items-center gap-nb-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_online_visible || false}
                            onChange={e => updateField('is_online_visible', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <div>
                            <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">Online Visible</span>
                            <p className="text-xs text-fg-subtle">Show this product in the Daily Store online catalog (requires Active status)</p>
                        </div>
                    </label>
                </div>
            </FormSection>
        </div>
    );
};

export default StockTrackingTab;
