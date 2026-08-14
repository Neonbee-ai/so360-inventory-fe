import React, { useEffect, useState } from 'react';
import { procurementService } from '../../services/procurementService';
import { inventoryService } from '../../services/inventoryService';
import { useActivity } from '@so360/shell-context';
import { toast, getErrorMessage } from '@so360/design-system';

const GRNEntryPage = () => {
    const { recordActivity } = useActivity();
    const [pos, setPos] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [receiptLines, setReceiptLines] = useState<any[]>([]);
    const [grnData, setGrnData] = useState({
        grn_number: '',
        warehouse_id: '',
        received_date: new Date().toISOString().slice(0, 10),
        supplier_delivery_note: '',
        vehicle_number: '',
        transporter: '',
        gate_entry_no: '',
        inspection_status: 'not_required',
        notes: '',
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [poData, whData] = await Promise.all([
                procurementService.getPOs(),
                inventoryService.getLocations()
            ]);
            setPos(poData.filter((po: any) => ['sent', 'acknowledged', 'partially_received'].includes(po.status)));
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
            rejected_quantity: 0,
            damaged_quantity: 0,
            batch_number: '',
            expiry_date: '',
            serial_numbers: '',
            rejection_reason: '',
            description: l.description,
            unit_cost: l.unit_price ?? null,
            _expanded: false,
        })));
    };

    const updateLine = (idx: number, field: string, value: any) => {
        const next = [...receiptLines];
        next[idx] = { ...next[idx], [field]: value };
        setReceiptLines(next);
    };

    /** Quantity that will actually enter stock for a line. */
    const acceptedQty = (line: any) =>
        (parseFloat(String(line.quantity_received)) || 0)
        - (parseFloat(String(line.rejected_quantity)) || 0)
        - (parseFloat(String(line.damaged_quantity)) || 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const overRejected = receiptLines.find(l => parseFloat(String(l.quantity_received)) > 0 && acceptedQty(l) < 0);
        if (overRejected) {
            toast.warning(`Rejected + damaged quantity exceeds the received quantity for "${overRejected.description}".`);
            return;
        }

        try {
            const createdGRN = await procurementService.createGRN({
                ...grnData,
                po_id: selectedPo.id,
                vendor_id: selectedPo.vendor_id || undefined,
                items: receiptLines.filter(l => parseFloat(String(l.quantity_received)) > 0).map(l => ({
                    po_line_id: l.po_line_id,
                    item_id: l.item_id,
                    ordered_quantity: l.ordered,
                    quantity_received: parseFloat(l.quantity_received),
                    rejected_quantity: parseFloat(String(l.rejected_quantity)) || 0,
                    damaged_quantity: parseFloat(String(l.damaged_quantity)) || 0,
                    accepted_quantity: acceptedQty(l),
                    batch_number: l.batch_number || undefined,
                    expiry_date: l.expiry_date || undefined,
                    serial_numbers: l.serial_numbers
                        ? String(l.serial_numbers).split(',').map((s: string) => s.trim()).filter(Boolean)
                        : undefined,
                    rejection_reason: l.rejection_reason || undefined,
                    unit_cost: l.unit_cost ?? null,
                }))
            });
            recordActivity({ eventType: 'inventory.grn.created', eventCategory: 'financials', description: `Created GRN #${grnData.grn_number} for PO #${selectedPo.po_number}`, resourceType: 'grn', resourceId: createdGRN?.id }).catch(() => {});
            toast.success('GRN Created Successfully');
            window.location.reload();
        } catch (error: any) {
            toast.error(`GRN creation failed: ${getErrorMessage(error, 'Failed to create GRN')}`);
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
                                        aria-label="Receiving Warehouse"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                        onChange={e => setGrnData({ ...grnData, warehouse_id: e.target.value })}
                                    >
                                        <option value="">Select Warehouse</option>
                                        {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Received Date</label>
                                    <input
                                        type="date"
                                        value={grnData.received_date}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                        onChange={e => setGrnData({ ...grnData, received_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Delivery Note</label>
                                    <input
                                        type="text"
                                        placeholder="Challan / DN number"
                                        value={grnData.supplier_delivery_note}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                        onChange={e => setGrnData({ ...grnData, supplier_delivery_note: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. KA-01-AB-1234"
                                        value={grnData.vehicle_number}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-mono"
                                        onChange={e => setGrnData({ ...grnData, vehicle_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transporter</label>
                                    <input
                                        type="text"
                                        value={grnData.transporter}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                        onChange={e => setGrnData({ ...grnData, transporter: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gate Entry No.</label>
                                    <input
                                        type="text"
                                        value={grnData.gate_entry_no}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-mono"
                                        onChange={e => setGrnData({ ...grnData, gate_entry_no: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quality Inspection</label>
                                    <select
                                        aria-label="Quality Inspection"
                                        value={grnData.inspection_status}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                        onChange={e => setGrnData({ ...grnData, inspection_status: e.target.value })}
                                    >
                                        <option value="not_required">Not required</option>
                                        <option value="pending">Required — pending</option>
                                        <option value="passed">Inspected — passed</option>
                                        <option value="partial">Inspected — partial</option>
                                        <option value="failed">Inspected — failed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">2. Verify Quantities</label>
                                <div className="space-y-4">
                                    {receiptLines.map((line, idx) => (
                                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                                            <div className="flex items-center justify-between gap-6">
                                                <div className="flex-1">
                                                    <div className="font-semibold text-slate-200 uppercase tracking-tight text-sm">{line.description}</div>
                                                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">
                                                        Ordered: {line.ordered} | Already received: {line.already_received} | Accepted now: <span className={acceptedQty(line) < 0 ? 'text-rose-400' : 'text-emerald-400'}>{acceptedQty(line)}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => updateLine(idx, '_expanded', !line._expanded)}
                                                    className="text-xs font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300 transition-colors"
                                                >
                                                    {line._expanded ? 'Hide details' : 'Batch / QC'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Received</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        aria-label={`Received quantity for ${line.description}`}
                                                        value={line.quantity_received}
                                                        onChange={e => updateLine(idx, 'quantity_received', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-emerald-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejected</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        aria-label={`Rejected quantity for ${line.description}`}
                                                        value={line.rejected_quantity}
                                                        onChange={e => updateLine(idx, 'rejected_quantity', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-rose-400 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Damaged</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        aria-label={`Damaged quantity for ${line.description}`}
                                                        value={line.damaged_quantity}
                                                        onChange={e => updateLine(idx, 'damaged_quantity', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-amber-400 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    />
                                                </div>
                                            </div>

                                            {line._expanded && (
                                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/70 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Batch Number</label>
                                                        <input
                                                            type="text"
                                                            aria-label={`Batch number for ${line.description}`}
                                                            value={line.batch_number}
                                                            onChange={e => updateLine(idx, 'batch_number', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expiry Date</label>
                                                        <input
                                                            type="date"
                                                            aria-label={`Expiry date for ${line.description}`}
                                                            value={line.expiry_date}
                                                            onChange={e => updateLine(idx, 'expiry_date', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serial Numbers</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Comma separated"
                                                            aria-label={`Serial numbers for ${line.description}`}
                                                            value={line.serial_numbers}
                                                            onChange={e => updateLine(idx, 'serial_numbers', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejection Reason</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Why units were rejected"
                                                            aria-label={`Rejection reason for ${line.description}`}
                                                            value={line.rejection_reason}
                                                            onChange={e => updateLine(idx, 'rejection_reason', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receipt Notes</label>
                                <textarea
                                    value={grnData.notes}
                                    placeholder="Condition of the shipment, discrepancies, remarks for the buyer..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none"
                                    onChange={e => setGrnData({ ...grnData, notes: e.target.value })}
                                />
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
