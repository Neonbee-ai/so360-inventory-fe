import React, { useEffect, useState } from 'react';
import { qualityService } from '../../services/qualityService';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { toast, getErrorMessage } from '@so360/design-system';

export const RETURN_STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
    approved: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dispatched: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    settled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const REASONS = [
    { value: 'damaged', label: 'Damaged' },
    { value: 'wrong_item', label: 'Wrong item' },
    { value: 'excess_delivery', label: 'Excess delivery' },
    { value: 'expired', label: 'Expired' },
    { value: 'quality_failure', label: 'Quality failure' },
    { value: 'other', label: 'Other' },
];

const RESOLUTIONS = [
    { value: 'credit_note', label: 'Credit note' },
    { value: 'replacement', label: 'Replacement' },
    { value: 'refund', label: 'Refund' },
    { value: 'none', label: 'No settlement' },
];

/** The next step available for a return, given where it is. */
const NEXT_STEP: Record<string, { status: string; label: string } | undefined> = {
    draft: { status: 'approved', label: 'Approve' },
    approved: { status: 'dispatched', label: 'Mark Dispatched' },
    dispatched: { status: 'settled', label: 'Settle' },
};

const VendorReturnsPage = () => {
    const formatters = useInventoryFormatters();
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [grns, setGrns] = useState<any[]>([]);
    const [selectedGrn, setSelectedGrn] = useState<any>(null);
    const [form, setForm] = useState({ reason: 'damaged', resolution: 'credit_note', remarks: '' });
    const [lines, setLines] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [settling, setSettling] = useState<any>(null);
    const [creditNote, setCreditNote] = useState({ credit_note_number: '', credit_note_date: '' });

    useEffect(() => { fetchData(); }, [statusFilter]);

    const fetchData = async () => {
        try {
            setFetchError(null);
            const data = await qualityService.getReturns(statusFilter ? { status: statusFilter } : {});
            setReturns(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(getErrorMessage(err, 'Failed to load vendor returns'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!showForm || grns.length) return;
        procurementService.getGRNs()
            .then((g: any) => setGrns(Array.isArray(g) ? g : []))
            .catch(() => setGrns([]));
    }, [showForm]);

    const selectGrn = (id: string) => {
        const grn = grns.find(g => g.id === id);
        setSelectedGrn(grn || null);
        // Default to the units that were rejected or damaged on receipt — the
        // usual reason a return exists — but let the buyer change it.
        setLines((grn?.goods_receipt_lines || []).map((l: any) => {
            const rejected = (Number(l.rejected_quantity) || 0) + (Number(l.damaged_quantity) || 0);
            return {
                grn_line_id: l.id,
                item_id: l.item_id,
                description: l.description || l.item_id?.slice(0, 8) || 'Line',
                received: Number(l.quantity_received) || 0,
                rejected,
                quantity: String(rejected),
                unit_cost: String(Number(l.unit_cost) || 0),
                batch_number: l.batch_number || '',
                // Rejected units never entered stock; anything else did.
                already_excluded_from_stock: rejected > 0,
            };
        }));
    };

    const updateLine = (idx: number, field: string, value: any) => {
        const next = [...lines];
        next[idx] = { ...next[idx], [field]: value };
        setLines(next);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payloadLines = lines.filter(l => parseFloat(l.quantity) > 0);
        if (!selectedGrn) {
            toast.warning('Select the receipt the goods came in on.');
            return;
        }
        if (payloadLines.length === 0) {
            toast.warning('Enter a quantity on at least one line.');
            return;
        }
        const over = payloadLines.find(l => parseFloat(l.quantity) > l.received);
        if (over) {
            toast.warning(`Cannot return more than the ${over.received} units received for "${over.description}".`);
            return;
        }

        setSaving(true);
        try {
            await qualityService.createReturn({
                vendor_id: selectedGrn.vendor_id || selectedGrn.po?.vendor_id,
                grn_id: selectedGrn.id,
                po_id: selectedGrn.po_id,
                warehouse_id: selectedGrn.warehouse_id,
                reason: form.reason,
                resolution: form.resolution,
                remarks: form.remarks || undefined,
                items: payloadLines.map(l => ({
                    grn_line_id: l.grn_line_id,
                    item_id: l.item_id || undefined,
                    description: l.description,
                    quantity: parseFloat(l.quantity),
                    unit_cost: parseFloat(l.unit_cost) || 0,
                    batch_number: l.batch_number || undefined,
                    already_excluded_from_stock: l.already_excluded_from_stock,
                })),
            });
            toast.success('Vendor return raised');
            setShowForm(false);
            setSelectedGrn(null);
            setLines([]);
            setForm({ reason: 'damaged', resolution: 'credit_note', remarks: '' });
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to raise the return'));
        } finally {
            setSaving(false);
        }
    };

    const advance = async (ret: any) => {
        const step = NEXT_STEP[ret.status];
        if (!step) return;

        // Settling a credit-note return needs the vendor's credit note, so
        // collect it rather than letting the API reject the call.
        if (step.status === 'settled' && ret.resolution === 'credit_note') {
            setSettling(ret);
            return;
        }

        try {
            await qualityService.updateReturnStatus(ret.id, { status: step.status });
            toast.success(`Return ${step.status}`);
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to update the return'));
        }
    };

    const submitSettlement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!creditNote.credit_note_number) {
            toast.warning('Enter the vendor credit note number.');
            return;
        }
        try {
            await qualityService.updateReturnStatus(settling.id, {
                status: 'settled',
                credit_note_number: creditNote.credit_note_number,
                credit_note_date: creditNote.credit_note_date || undefined,
            });
            toast.success('Return settled');
            setSettling(null);
            setCreditNote({ credit_note_number: '', credit_note_date: '' });
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to settle the return'));
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {fetchError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                    <span>⚠</span> {fetchError}
                </div>
            )}

            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
                        Vendor Returns
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        Send back damaged, wrong, excess or expired goods and track the credit.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-rose-900/20 active:scale-95"
                >
                    + New Return
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Open Returns', value: returns.filter(r => ['draft', 'approved', 'dispatched'].includes(r.status)).length, icon: '📦' },
                    { label: 'Awaiting Credit', value: returns.filter(r => r.status === 'dispatched' && r.resolution === 'credit_note').length, icon: '🧾' },
                    { label: 'Settled', value: returns.filter(r => r.status === 'settled').length, icon: '✅' },
                    { label: 'Value Returned', value: formatters.formatCurrency(returns.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)), icon: '💰' },
                ].map((s, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{s.icon}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                        </div>
                        <div className="mt-4 text-2xl font-bold text-slate-100">{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <label htmlFor="return-status-filter" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                    id="return-status-filter"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                >
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="settled">Settled</option>
                </select>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Return</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Vendor</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Reason</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Resolution</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Value</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 animate-pulse">Loading returns...</td></tr>
                        ) : returns.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No vendor returns raised.</td></tr>
                        ) : returns.map(r => (
                            <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-200">{r.return_number}</div>
                                    <div className="text-xs text-slate-500">{r.grn?.grn_number || ''}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">{r.vendor_name || '—'}</td>
                                <td className="px-6 py-4 text-sm text-slate-400">{r.reason?.replace(/_/g, ' ')}</td>
                                <td className="px-6 py-4 text-sm text-slate-400">
                                    {r.resolution?.replace(/_/g, ' ')}
                                    {r.credit_note_number && (
                                        <div className="text-[10px] text-emerald-400 font-mono">{r.credit_note_number}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-100 font-bold">{formatters.formatCurrency(r.total_amount || 0)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${RETURN_STATUS_STYLES[r.status] || RETURN_STATUS_STYLES.draft}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {NEXT_STEP[r.status] ? (
                                        <button
                                            onClick={() => advance(r)}
                                            className="text-rose-400 hover:text-rose-300 font-semibold text-sm transition-colors"
                                        >
                                            {NEXT_STEP[r.status]!.label} →
                                        </button>
                                    ) : (
                                        <span className="text-slate-600 text-sm">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">New Vendor Return</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-50 text-2xl">×</button>
                        </div>
                        <form onSubmit={submit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="ret-grn" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goods Receipt</label>
                                    <select
                                        id="ret-grn"
                                        value={selectedGrn?.id || ''}
                                        onChange={e => selectGrn(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                                    >
                                        <option value="">Select a receipt</option>
                                        {grns.map(g => <option key={g.id} value={g.id}>{g.grn_number}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="ret-reason" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</label>
                                    <select
                                        id="ret-reason"
                                        value={form.reason}
                                        onChange={e => setForm({ ...form, reason: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                                    >
                                        {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="ret-resolution" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resolution</label>
                                    <select
                                        id="ret-resolution"
                                        value={form.resolution}
                                        onChange={e => setForm({ ...form, resolution: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                                    >
                                        {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {lines.length === 0 ? (
                                <div className="text-center py-6 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
                                    Select a receipt to choose what goes back.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lines Returned</label>
                                    {lines.map((l, idx) => (
                                        <div key={l.grn_line_id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-slate-200 truncate">{l.description}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    {l.received} received{l.rejected > 0 ? ` · ${l.rejected} rejected on arrival` : ''}
                                                </div>
                                            </div>
                                            <input
                                                type="number" min="0"
                                                aria-label={`Return quantity for ${l.description}`}
                                                value={l.quantity}
                                                onChange={e => updateLine(idx, 'quantity', e.target.value)}
                                                className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-rose-400 font-bold"
                                            />
                                            <input
                                                type="number" min="0" step="0.01"
                                                aria-label={`Unit cost for ${l.description}`}
                                                value={l.unit_cost}
                                                onChange={e => updateLine(idx, 'unit_cost', e.target.value)}
                                                className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-slate-200"
                                            />
                                            <label className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Already excluded from stock for ${l.description}`}
                                                    checked={l.already_excluded_from_stock}
                                                    onChange={e => updateLine(idx, 'already_excluded_from_stock', e.target.checked)}
                                                />
                                                Never stocked
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="ret-remarks" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                                <textarea
                                    id="ret-remarks"
                                    value={form.remarks}
                                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 text-slate-200 resize-none"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button type="submit" disabled={saving} className="flex-1 px-6 py-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded-2xl font-bold">
                                    {saving ? 'Raising...' : 'Raise Return'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {settling && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-100">Settle {settling.return_number}</h2>
                            <button onClick={() => setSettling(null)} className="text-slate-500 hover:text-slate-50 text-2xl">×</button>
                        </div>
                        <form onSubmit={submitSettlement} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="cn-number" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Credit Note Number</label>
                                <input
                                    id="cn-number"
                                    type="text"
                                    value={creditNote.credit_note_number}
                                    onChange={e => setCreditNote({ ...creditNote, credit_note_number: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="cn-date" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Credit Note Date</label>
                                <input
                                    id="cn-date"
                                    type="date"
                                    value={creditNote.credit_note_date}
                                    onChange={e => setCreditNote({ ...creditNote, credit_note_date: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button type="submit" className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold">
                                    Settle
                                </button>
                                <button type="button" onClick={() => setSettling(null)} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorReturnsPage;
