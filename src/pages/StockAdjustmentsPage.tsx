import React, { useState, useEffect } from 'react';
import { Plus, History, TrendingUp, TrendingDown, MapPin, AlertCircle, Package } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { StockMovement, Item, Warehouse } from '../types/inventory';
import { Table } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useActivity, useShellBridge } from '@so360/shell-context';

const StockAdjustmentsPage = () => {
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canAdjustStock = (shell?.isFeatureEnabled?.('action:inventory:stock:adjust') ?? true);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        item_id: '',
        warehouse_id: '',
        type: 'Increase' as 'Increase' | 'Decrease',
        quantity: 0,
        reason_code: '',
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [itemData, whData, adjustmentData] = await Promise.all([
                inventoryService.getItems(),
                inventoryService.getLocations(),
                inventoryService.getAdjustmentHistory()
            ]);
            setItems(itemData.data || []);
            setWarehouses(whData);
            setMovements(adjustmentData || []);
        } catch (err) {
            setError('Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.quantity <= 0) {
            setError('Quantity must be positive');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const signedQty = form.type === 'Increase' ? form.quantity : -form.quantity;
            await inventoryService.createAdjustment({
                item_id: form.item_id,
                warehouse_id: form.warehouse_id,
                quantity: signedQty,
                reason_code: form.reason_code
            });
            const itemName = items.find(i => i.id === form.item_id)?.name || 'item';
            recordActivity({ eventType: 'adjustment.made', eventCategory: 'inventory', description: `${form.type} stock of "${itemName}" by ${form.quantity}`, resourceType: 'adjustment' }).catch(() => {});

            setIsModalOpen(false);
            fetchData();
            setForm({
                item_id: '',
                warehouse_id: '',
                type: 'Increase',
                quantity: 0,
                reason_code: '',
            });
        } catch (err: any) {
            setError(err.message || 'Failed to create adjustment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = [
        {
            header: 'Item',
            accessor: (m: StockMovement) => (
                <div className="flex items-center gap-3">
                    <Package size={16} className="text-slate-500" />
                    <span className="font-semibold text-slate-50">{m.items?.name}</span>
                </div>
            )
        },
        {
            header: 'Warehouse',
            accessor: (m: StockMovement) => (
                <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin size={14} className="text-slate-500" />
                    <span>{m.warehouses?.name}</span>
                </div>
            )
        },
        {
            header: 'Change',
            accessor: (m: StockMovement) => (
                <div className="flex items-center gap-2 font-bold">
                    {m.quantity > 0 ? (
                        <span className="text-emerald-400">+{m.quantity}</span>
                    ) : (
                        <span className="text-rose-400">{m.quantity}</span>
                    )}
                </div>
            )
        },
        {
            header: 'Reason',
            accessor: (m: StockMovement) => m.reason_code,
            className: 'text-slate-500 text-sm'
        },
        {
            header: 'Date',
            accessor: (m: StockMovement) => new Date(m.created_at).toLocaleString()
        }
    ];

    return (
        <div className="p-8">
            <header className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
                        <History className="text-blue-500" /> Stock Adjustments
                    </h1>
                    <p className="text-slate-400 mt-1">Manual corrections for physical stock truth</p>
                </div>
                {can('create_adjustment') && canAdjustStock && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                        <Plus size={20} />
                        New Adjustment
                    </button>
                )}
            </header>

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <Table
                data={movements}
                columns={columns}
                isLoading={isLoading}
                emptyMessage="No recent adjustments found."
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Manual Stock Adjustment"
            >
                <form onSubmit={handleSubmit} className="space-y-4 text-slate-200">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Item *</label>
                        <select
                            required
                            value={form.item_id}
                            onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">Select Item...</option>
                            {items.map(i => (
                                <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Warehouse *</label>
                        <select
                            required
                            value={form.warehouse_id}
                            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">Select Warehouse...</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
                            <div className="flex p-1 bg-slate-800 rounded-lg border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, type: 'Increase' })}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${form.type === 'Increase' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                                >
                                    Increase
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, type: 'Decrease' })}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${form.type === 'Decrease' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
                                >
                                    Decrease
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Quantity *</label>
                            <input
                                required
                                type="number"
                                min="1"
                                value={form.quantity}
                                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center font-bold"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Reason Code *</label>
                        <select
                            required
                            value={form.reason_code}
                            onChange={(e) => setForm({ ...form, reason_code: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">Select Reason...</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="LOST">Lost / Stolen</option>
                            <option value="COUNT_CORRECTION">Inventory Count Correction</option>
                            <option value="RETURN">Customer Return (Manual)</option>
                            <option value="INITIAL">Initial Upload</option>
                        </select>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 font-semibold py-2.5 rounded-lg transition-all shadow-lg ${form.type === 'Increase' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}
                        >
                            {isSubmitting ? 'Processing...' : 'Commit Adjustment'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default StockAdjustmentsPage;
