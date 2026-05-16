import React, { useEffect, useState } from 'react';
import { procurementService } from '../../services/procurementService';
import { inventoryService } from '../../services/inventoryService';
import { useActivity } from '@so360/shell-context';

const GRNEntryPage = () => {
    const { recordActivity } = useActivity();
    const [pos, setPos] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [receiptLines, setReceiptLines] = useState<any[]>([]);
    const [grnData, setGrnData] = useState({ grn_number: '', warehouse_id: '' });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [poData, whData] = await Promise.all([
                procurementService.getPOs(),
                inventoryService.getLocations()
            ]);
            setPos(poData.filter((po: any) => po.status === 'sent' || po.status === 'partially_received'));
            setWarehouses(whData);
        } catch (error) {
            console.error('Failed to fetch initial data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPo = async (poId: string) => {
        const po = pos.find(p => p.id === poId);
        setSelectedPo(po);
        setReceiptLines(po.po_lines.map((l: any) => ({
            po_line_id: l.id,
            item_id: l.item_id,
            ordered: l.quantity,
            already_received: l.received_quantity,
            quantity_received: l.quantity - l.received_quantity,
            description: l.description
        })));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const createdGRN = await procurementService.createGRN({
                ...grnData,
                po_id: selectedPo.id,
                items: receiptLines.filter(l => l.quantity_received > 0).map(l => ({
                    po_line_id: l.po_line_id,
                    item_id: l.item_id,
                    quantity_received: parseFloat(l.quantity_received)
                }))
            });
            recordActivity({ eventType: 'inventory.grn.created', eventCategory: 'financials', description: `Created GRN #${grnData.grn_number} for PO #${selectedPo.po_number}`, resourceType: 'grn', resourceId: createdGRN?.id }).catch(() => {});
            alert('GRN Created Successfully');
            window.location.reload();
        } catch (error) {
            alert('Failed to create GRN');
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Goods Receipt Entry
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Record incoming shipments and update stock levels against Purchase Orders.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* PO Selector */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 block">1. Select Purchase Order</label>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {pos.map(po => (
                                <button
                                    key={po.id}
                                    onClick={() => handleSelectPo(po.id)}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedPo?.id === po.id
                                            ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                        }`}
                                >
                                    <div className="font-bold">#PO-{po.po_number || po.id.slice(0, 8).toUpperCase()}</div>
                                    <div className="text-xs opacity-70 mt-1">{po.vendor?.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Receipt Details */}
                <div className="md:col-span-2 space-y-6">
                    {selectedPo ? (
                        <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">GRN Number</label>
                                    <input
                                        required
                                        placeholder="e.g. GRN-2024-001"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-mono"
                                        onChange={e => setGrnData({ ...grnData, grn_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receiving Warehouse</label>
                                    <select
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                        onChange={e => setGrnData({ ...grnData, warehouse_id: e.target.value })}
                                    >
                                        <option value="">Select Warehouse</option>
                                        {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">2. Verify Quantities</label>
                                <div className="space-y-4">
                                    {receiptLines.map((line, idx) => (
                                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-6">
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-200 uppercase tracking-tight text-sm">{line.description}</div>
                                                <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">
                                                    Ordered: {line.ordered} | Received: {line.already_received}
                                                </div>
                                            </div>
                                            <div className="w-32 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={line.quantity_received}
                                                    onChange={e => {
                                                        const newLines = [...receiptLines];
                                                        newLines[idx].quantity_received = e.target.value;
                                                        setReceiptLines(newLines);
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-emerald-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-fuchsia-900/20 active:scale-[0.98]">
                                Post Goods Receipt
                            </button>
                        </form>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-3xl p-12 bg-slate-900/10">
                            <span className="text-5xl mb-4 opacity-20">📦</span>
                            <p className="font-medium">Select a Purchase Order to start receiving goods.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GRNEntryPage;
