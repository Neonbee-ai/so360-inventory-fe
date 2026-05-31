import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import { inventoryService } from '../../services/inventoryService';
import ItemSearchSelector from '../../components/ItemSearchSelector';

interface LineItem {
    item_id: string;
    _selectedName: string;
    warehouse_id: string;
    _warehouseName: string;
    quantity: number;
    unit_cost: number;
}

const OpeningBalancePage = () => {
    const navigate = useNavigate();
    const today = new Date().toISOString().split('T')[0];

    const [vendors, setVendors] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingUnlinked, setLoadingUnlinked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ po: any; grn: any; movements_linked: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        vendor_id: '',
        vendor_name: '',
        po_number: '',
        grn_number: '',
        effective_date: today,
        note: '',
    });

    const [items, setItems] = useState<LineItem[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [vendorData, locData] = await Promise.all([
                vendorService.getVendors(),
                inventoryService.getLocations(),
            ]);
            setVendors(Array.isArray(vendorData) ? vendorData : (vendorData?.data || []));
            const locs = Array.isArray(locData) ? locData : (locData?.data || locData?.warehouses || []);
            setWarehouses(locs);

            // Auto-generate PO / GRN numbers
            const year = new Date().getFullYear();
            setFormData(prev => ({
                ...prev,
                po_number: `OB-${year}-001`,
                grn_number: `GRN-OB-${year}-001`,
            }));
        } catch (err: any) {
            console.error('Failed to load initial data', err);
        } finally {
            setLoading(false);
        }
    };

    const loadUnlinkedStock = async () => {
        setLoadingUnlinked(true);
        setError(null);
        try {
            const data = await procurementService.getUnlinkedMovements();
            const rows: LineItem[] = (Array.isArray(data) ? data : []).map((row: any) => ({
                item_id: row.item_id,
                _selectedName: row.item_name ? `${row.item_name}${row.item_sku ? ` (${row.item_sku})` : ''}` : row.item_id,
                warehouse_id: row.warehouse_id,
                _warehouseName: row.warehouse_name || row.warehouse_id,
                quantity: row.total_qty,
                unit_cost: row.avg_cost,
            }));

            if (rows.length === 0) {
                setError('No unlinked stock movements found. All items already have GRN references.');
            } else {
                setItems(rows);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load unlinked stock');
        } finally {
            setLoadingUnlinked(false);
        }
    };

    const addEmptyLine = () => {
        setItems(prev => [...prev, {
            item_id: '',
            _selectedName: '',
            warehouse_id: warehouses[0]?.id || '',
            _warehouseName: warehouses[0]?.name || '',
            quantity: 1,
            unit_cost: 0,
        }]);
    };

    const removeLine = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof LineItem, value: any) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const updateItemWithProduct = (index: number, selected: { id: string; name: string; sku: string; price?: number }) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                item_id: selected.id,
                _selectedName: `${selected.name} (${selected.sku})`,
                unit_cost: selected.price ?? 0,
            };
            return next;
        });
    };

    const totalValue = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validItems = items.filter(i => i.item_id && i.warehouse_id && i.quantity > 0);
        if (validItems.length === 0) {
            setError('Add at least one complete item line.');
            return;
        }

        setSubmitting(true);
        try {
            const dto: any = {
                po_number: formData.po_number.trim() || undefined,
                grn_number: formData.grn_number.trim() || undefined,
                effective_date: formData.effective_date || undefined,
                note: formData.note.trim() || undefined,
                items: validItems.map(i => ({
                    item_id: i.item_id,
                    warehouse_id: i.warehouse_id,
                    quantity: Number(i.quantity),
                    unit_cost: Number(i.unit_cost),
                })),
            };

            if (formData.vendor_id) {
                dto.vendor_id = formData.vendor_id;
            } else {
                dto.vendor_name = formData.vendor_name.trim() || 'Opening Balance Supplier';
            }

            const response = await procurementService.createOpeningBalance(dto);
            setResult(response);
        } catch (err: any) {
            setError(err.message || 'Failed to create opening balance');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (result) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8">
                    <div className="text-emerald-400 text-4xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-emerald-400 mb-2">Opening Balance Created</h2>
                    <p className="text-slate-400 mb-6">Procurement documents have been created and stock movements linked.</p>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">PO Number</div>
                            <div className="font-bold text-slate-100">{result.po?.po_number}</div>
                            <div className="text-[10px] text-emerald-400 mt-1">Status: {result.po?.status}</div>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">GRN Number</div>
                            <div className="font-bold text-slate-100">{result.grn?.grn_number}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{result.grn?.received_at?.split('T')[0]}</div>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Movements Linked</div>
                            <div className="font-bold text-slate-100">{result.movements_linked}</div>
                            <div className="text-[10px] text-slate-400 mt-1">stock records</div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate(`/procurement/po/${result.po?.id}`)}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all"
                        >
                            View PO
                        </button>
                        <button
                            onClick={() => navigate(`/procurement/grn/${result.grn?.id}`)}
                            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-50 rounded-xl font-semibold text-sm transition-all"
                        >
                            View GRN
                        </button>
                        <button
                            onClick={() => navigate('/procurement/po')}
                            className="px-5 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-xl font-semibold text-sm transition-all"
                        >
                            Back to PO List
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <button
                        onClick={() => navigate('/procurement/po')}
                        className="text-slate-500 hover:text-slate-300 text-sm mb-3 flex items-center gap-1 transition-colors"
                    >
                        ← Back to Purchase Orders
                    </button>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                        Opening Balance
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        Create backdated procurement documents for existing stock — without double-counting quantities.
                    </p>
                </div>
            </div>

            {/* Info banner */}
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-300">
                <strong className="font-bold">How this works:</strong> This creates a Purchase Order (status: Received) and a Goods Receipt Note linked to your existing stock.
                Stock quantities are <strong>NOT</strong> changed — only audit trail documents are created.
                Use <em>Load Unlinked Stock</em> to auto-fill items that currently have no GRN.
            </div>

            <form onSubmit={handleSubmit}>
                {/* Section A: Document Info */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-6">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-5">Section A — Document Info</h2>
                    <div className="grid grid-cols-2 gap-5">
                        {/* Vendor */}
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Vendor</label>
                            <div className="flex gap-3">
                                <select
                                    value={formData.vendor_id}
                                    onChange={e => setFormData(prev => ({ ...prev, vendor_id: e.target.value, vendor_name: '' }))}
                                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm"
                                >
                                    <option value="">-- Auto-create placeholder --</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                                {!formData.vendor_id && (
                                    <input
                                        type="text"
                                        placeholder="Placeholder vendor name"
                                        value={formData.vendor_name}
                                        onChange={e => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600"
                                    />
                                )}
                            </div>
                        </div>

                        {/* PO Number */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">PO Number</label>
                            <input
                                type="text"
                                value={formData.po_number}
                                onChange={e => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                                placeholder="OB-2026-001"
                                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600"
                            />
                        </div>

                        {/* GRN Number */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">GRN Number</label>
                            <input
                                type="text"
                                value={formData.grn_number}
                                onChange={e => setFormData(prev => ({ ...prev, grn_number: e.target.value }))}
                                placeholder="GRN-OB-2026-001"
                                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600"
                            />
                        </div>

                        {/* Effective Date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Effective Date (Backdated)</label>
                            <input
                                type="date"
                                value={formData.effective_date}
                                onChange={e => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm"
                            />
                        </div>

                        {/* Note */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Note</label>
                            <input
                                type="text"
                                value={formData.note}
                                onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="e.g. Initial inventory setup Jan 2026"
                                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600"
                            />
                        </div>
                    </div>
                </div>

                {/* Section B: Item Lines */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Section B — Item Lines</h2>
                        <button
                            type="button"
                            onClick={loadUnlinkedStock}
                            disabled={loadingUnlinked}
                            className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loadingUnlinked ? (
                                <><span className="w-3 h-3 border-2 border-indigo-400/20 border-t-indigo-400 rounded-full animate-spin inline-block"></span> Loading...</>
                            ) : (
                                '⟳ Load Unlinked Stock'
                            )}
                        </button>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-10 text-slate-600 text-sm">
                            Click <strong className="text-slate-400">Load Unlinked Stock</strong> to auto-fill items,
                            or <button type="button" onClick={addEmptyLine} className="text-blue-400 hover:underline">add a line manually</button>.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800">
                                            <th className="pb-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest pr-3">Item</th>
                                            <th className="pb-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest pr-3">Warehouse</th>
                                            <th className="pb-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest pr-3 w-28">Qty on Hand</th>
                                            <th className="pb-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest pr-3 w-32">Unit Cost</th>
                                            <th className="pb-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest w-32">Total Value</th>
                                            <th className="pb-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="py-3 pr-3">
                                                    {item.item_id ? (
                                                        <div className="text-slate-300 font-medium">{item._selectedName}</div>
                                                    ) : (
                                                        <ItemSearchSelector
                                                            value={item.item_id}
                                                            selectedName={item._selectedName}
                                                            onSelect={selected => updateItemWithProduct(idx, selected)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3">
                                                    {item._warehouseName && item.warehouse_id ? (
                                                        <select
                                                            value={item.warehouse_id}
                                                            onChange={e => {
                                                                const wh = warehouses.find(w => w.id === e.target.value);
                                                                updateLine(idx, 'warehouse_id', e.target.value);
                                                                updateLine(idx, '_warehouseName', wh?.name || e.target.value);
                                                            }}
                                                            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm w-full"
                                                        >
                                                            {warehouses.map(w => (
                                                                <option key={w.id} value={w.id}>{w.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <select
                                                            value={item.warehouse_id}
                                                            onChange={e => {
                                                                const wh = warehouses.find(w => w.id === e.target.value);
                                                                updateLine(idx, 'warehouse_id', e.target.value);
                                                                updateLine(idx, '_warehouseName', wh?.name || e.target.value);
                                                            }}
                                                            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm w-full"
                                                        >
                                                            <option value="">Select warehouse</option>
                                                            {warehouses.map(w => (
                                                                <option key={w.id} value={w.id}>{w.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        value={item.quantity}
                                                        onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm"
                                                    />
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.unit_cost}
                                                        onChange={e => updateLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm"
                                                    />
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <span className="font-mono text-slate-300">
                                                        {(item.quantity * item.unit_cost).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLine(idx)}
                                                        className="text-slate-600 hover:text-rose-400 transition-colors text-lg"
                                                    >
                                                        ×
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="mt-5 flex justify-between items-center pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={addEmptyLine}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                                >
                                    + Add line manually
                                </button>
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Total Inventory Value</div>
                                    <div className="text-2xl font-bold text-slate-100 font-mono">
                                        {totalValue.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{items.filter(i => i.item_id).length} items • stock unchanged</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Submit */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/procurement/po')}
                        className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-semibold transition-all hover:border-slate-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || items.filter(i => i.item_id).length === 0}
                        className="px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-900/20 active:scale-95 flex items-center gap-2"
                    >
                        {submitting ? (
                            <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block"></span> Creating...</>
                        ) : (
                            'Create Opening Balance'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OpeningBalancePage;
