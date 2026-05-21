import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus, MapPin, Package, Calendar, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Item, Warehouse } from '../types/inventory';
import { Table } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useActivity, useShellBridge } from '@so360/shell-context';

const StockTransfersPage = () => {
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canTransferStock = (shell?.isFeatureEnabled?.('action:inventory:stock:transfer') ?? true);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        item_id: '',
        from_warehouse_id: '',
        to_warehouse_id: '',
        quantity: 0
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [itemData, whData, transferData] = await Promise.all([
                inventoryService.getItems(),
                inventoryService.getLocations(),
                inventoryService.getTransferHistory()
            ]);
            setItems((itemData.data || []).filter((i: Item) => i.type === 'product'));
            setWarehouses(whData);

            // Process transfers - group outbound movements (negative quantity)
            // Each transfer creates 2 movements: outbound (-qty) and inbound (+qty)
            const outboundTransfers = (transferData || [])
                .filter((m: any) => m.quantity < 0)
                .map((m: any) => ({
                    ...m,
                    quantity: Math.abs(m.quantity),
                    item_name: m.items?.name || 'Unknown Item',
                    from_warehouse_name: m.warehouses?.name || 'Unknown'
                }));
            setTransfers(outboundTransfers);
        } catch (err) {
            setError('Failed to fetch transfers data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (form.from_warehouse_id === form.to_warehouse_id) {
            setError('Source and destination warehouses must be different');
            return;
        }

        if (form.quantity <= 0) {
            setError('Quantity must be positive');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await inventoryService.createTransfer(form);
            const itemName = items.find(i => i.id === form.item_id)?.name || 'item';
            recordActivity({ eventType: 'transfer.created', eventCategory: 'inventory', description: `Created stock transfer for ${itemName} (qty: ${form.quantity})`, resourceType: 'transfer' }).catch(() => {});
            setIsModalOpen(false);
            fetchData();
            setForm({ item_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: 0 });
        } catch (err: any) {
            setError(err.message || 'Failed to create transfer');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = [
        {
            header: 'Transfer Info',
            accessor: (tr: any) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs text-right">
                        <Calendar size={12} />
                        <span>{new Date(tr.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Movement',
            accessor: (tr: any) => (
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">From</span>
                        <span className="text-white font-medium text-sm">{tr.from_warehouse_name || 'Warehouse A'}</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-600" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">To</span>
                        <span className="text-white font-medium text-sm">{tr.to_warehouse_name || 'Warehouse B'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Item',
            accessor: (tr: any) => (
                <div className="flex items-center gap-2">
                    <Package size={14} className="text-slate-500" />
                    <span className="text-slate-200">{tr.item_name || 'Item Name'}</span>
                </div>
            )
        },
        {
            header: 'Quantity',
            accessor: (tr: any) => (
                <span className="font-bold text-blue-400 text-lg">{tr.quantity || 0}</span>
            )
        }
    ];

    return (
        <div className="p-8">
            <header className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <ArrowRightLeft className="text-blue-500" /> Stock Transfers
                    </h1>
                    <p className="text-slate-400 mt-1">Inter-warehouse stock movements</p>
                </div>
                {can('create_transfer') && canTransferStock && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                        <Plus size={20} />
                        Plan Transfer
                    </button>
                )}
            </header>

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <Table
                data={transfers}
                columns={columns}
                isLoading={isLoading}
                emptyMessage="No stock transfers found."
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Internal Stock Transfer"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Source Warehouse *</label>
                            <select
                                required
                                value={form.from_warehouse_id}
                                onChange={(e) => setForm({ ...form, from_warehouse_id: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="">Select Source...</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Destination Warehouse *</label>
                            <select
                                required
                                value={form.to_warehouse_id}
                                onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="">Select Destination...</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
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
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-center text-xl"
                        />
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3 mt-4">
                        <CheckCircle2 size={18} className="text-blue-400 mt-0.5" />
                        <div className="text-[11px] text-blue-300">
                            <p className="font-bold mb-1 uppercase tracking-tight">Atomic Movement</p>
                            <p className="opacity-70">Internal transfers are atomic. Stock will be deducted from source and added to destination simultaneously.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isSubmitting ? 'Transferring...' : 'Execute Transfer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default StockTransfersPage;
