import React from 'react';
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

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600';
const labelClass = 'block text-sm font-medium text-slate-400 mb-1.5';

const StockTrackingTab: React.FC<StockTrackingTabProps> = ({
    min_stock_threshold, reorder_level, is_batch_tracked, is_serial_tracked, is_active,
    updateField, default_warehouse_id, warehouses, is_online_visible,
}) => {
    return (
        <div className="space-y-8">
            <FormSection title="Stock Thresholds" description="Set alerts and automatic reorder levels">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Min Stock Threshold</label>
                        <input
                            type="number"
                            min="0"
                            value={min_stock_threshold}
                            onChange={e => updateField('min_stock_threshold', e.target.value)}
                            className={inputClass}
                            placeholder="0"
                        />
                        <p className="text-xs text-slate-600 mt-1">Alert when stock drops below this level</p>
                    </div>
                    <div>
                        <label className={labelClass}>Reorder Level</label>
                        <input
                            type="number"
                            min="0"
                            value={reorder_level}
                            onChange={e => updateField('reorder_level', e.target.value)}
                            className={inputClass}
                            placeholder="0"
                        />
                        <p className="text-xs text-slate-600 mt-1">Trigger reorder when stock reaches this level</p>
                    </div>
                </div>
            </FormSection>

            <FormSection title="Tracking Options">
                <div className="flex flex-col gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_batch_tracked}
                            onChange={e => updateField('is_batch_tracked', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <div>
                            <span className="text-sm text-slate-300 group-hover:text-slate-50 transition-colors">Batch Tracked</span>
                            <p className="text-xs text-slate-600">Track items by batch/lot numbers for expiry and recalls</p>
                        </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_serial_tracked}
                            onChange={e => updateField('is_serial_tracked', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <div>
                            <span className="text-sm text-slate-300 group-hover:text-slate-50 transition-colors">Serial Tracked</span>
                            <p className="text-xs text-slate-600">Track each individual item by unique serial number</p>
                        </div>
                    </label>
                </div>
            </FormSection>

            {/* Default Warehouse */}
            {warehouses && warehouses.length > 0 && (
                <FormSection title="Default Warehouse" description="Assign the primary warehouse for this item">
                    <select
                        value={default_warehouse_id || ''}
                        onChange={e => updateField('default_warehouse_id', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Auto-assign (first active warehouse)</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </FormSection>
            )}

            <FormSection title="Status & Visibility">
                <div className="flex flex-col gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_active}
                            onChange={e => updateField('is_active', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <div>
                            <span className="text-sm text-slate-300 group-hover:text-slate-50 transition-colors">Active</span>
                            <p className="text-xs text-slate-600">Inactive items are hidden from selection lists and ordering</p>
                        </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={is_online_visible || false}
                            onChange={e => updateField('is_online_visible', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <div>
                            <span className="text-sm text-slate-300 group-hover:text-slate-50 transition-colors">Online Visible</span>
                            <p className="text-xs text-slate-600">Show this product in the Daily Store online catalog (requires Active status)</p>
                        </div>
                    </label>
                </div>
            </FormSection>
        </div>
    );
};

export default StockTrackingTab;
