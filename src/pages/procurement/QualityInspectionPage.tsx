import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { qualityService } from '../../services/qualityService';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { toast, getErrorMessage } from '@so360/design-system';

export const QC_STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const RESULT_STYLES: Record<string, string> = {
    passed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

/**
 * Quality inspections queue.
 *
 * A receipt routed to QC holds its stock, so this page is the gate between
 * goods arriving and goods being usable — recording a result is what releases
 * the accepted quantity into inventory.
 */
const QualityInspectionPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [inspections, setInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [active, setActive] = useState<any>(null);
    const [resultLines, setResultLines] = useState<any[]>([]);
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [showOpenForm, setShowOpenForm] = useState(false);
    const [grns, setGrns] = useState<any[]>([]);
    const [grnId, setGrnId] = useState('');

    useEffect(() => { fetchData(); }, [statusFilter]);

    const fetchData = async () => {
        try {
            setFetchError(null);
            const data = await qualityService.getInspections(statusFilter ? { status: statusFilter } : {});
            setInspections(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(getErrorMessage(err, 'Failed to load inspections'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!showOpenForm || grns.length) return;
        procurementService.getGRNs()
            .then((g: any) => setGrns(Array.isArray(g) ? g : []))
            .catch(() => setGrns([]));
    }, [showOpenForm]);

    const openInspection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grnId) {
            toast.warning('Select the goods receipt to inspect.');
            return;
        }
        setSaving(true);
        try {
            await qualityService.createInspection({ grn_id: grnId });
            toast.success('Inspection opened');
            setShowOpenForm(false);
            setGrnId('');
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to open inspection'));
        } finally {
            setSaving(false);
        }
    };

    const startInspecting = (inspection: any) => {
        setActive(inspection);
        setRemarks('');
        setResultLines((inspection.quality_inspection_lines || []).map((l: any) => ({
            line_id: l.id,
            description: l.description || l.item_id?.slice(0, 8) || 'Line',
            submitted: Number(l.received_quantity) || 0,
            accepted_quantity: String(Number(l.received_quantity) || 0),
            rejected_quantity: '0',
            defect_code: '',
            rejection_reason: '',
        })));
    };

    const updateResult = (idx: number, field: string, value: any) => {
        const next = [...resultLines];
        next[idx] = { ...next[idx], [field]: value };
        setResultLines(next);
    };

    const submitResult = async (e: React.FormEvent) => {
        e.preventDefault();
        const over = resultLines.find(
            l => (parseFloat(l.accepted_quantity) || 0) + (parseFloat(l.rejected_quantity) || 0) > l.submitted,
        );
        if (over) {
            toast.warning(`Accepted + rejected exceeds the ${over.submitted} units submitted for "${over.description}".`);
            return;
        }

        setSaving(true);
        try {
            const res = await qualityService.completeInspection(active.id, {
                remarks: remarks || undefined,
                lines: resultLines.map(l => ({
                    line_id: l.line_id,
                    accepted_quantity: parseFloat(l.accepted_quantity) || 0,
                    rejected_quantity: parseFloat(l.rejected_quantity) || 0,
                    defect_code: l.defect_code || undefined,
                    rejection_reason: l.rejection_reason || undefined,
                })),
            });
            const summary = res?.summary;
            toast.success(
                summary?.stock_released
                    ? `Inspection ${summary.result} — ${summary.accepted} units released to stock`
                    : `Inspection ${summary?.result}`,
            );
            setActive(null);
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to record the inspection'));
        } finally {
            setSaving(false);
        }
    };

    const totals = resultLines.reduce(
        (acc, l) => ({
            accepted: acc.accepted + (parseFloat(l.accepted_quantity) || 0),
            rejected: acc.rejected + (parseFloat(l.rejected_quantity) || 0),
        }),
        { accepted: 0, rejected: 0 },
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {fetchError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                    <span>⚠</span> {fetchError}
                </div>
            )}

            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                        Quality Inspection
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        Receipts held for inspection. Stock is released only for what passes.
                    </p>
                </div>
                <button
                    onClick={() => setShowOpenForm(true)}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-amber-900/20 active:scale-95"
                >
                    + Open Inspection
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Awaiting Inspection', value: inspections.filter(i => i.status === 'pending').length, icon: '⏳' },
                    { label: 'Completed', value: inspections.filter(i => i.status === 'completed').length, icon: '✅' },
                    { label: 'Failed', value: inspections.filter(i => i.result === 'failed').length, icon: '⛔' },
                    { label: 'Partial', value: inspections.filter(i => i.result === 'partial').length, icon: '⚠️' },
                ].map((s, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{s.icon}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                        </div>
                        <div className="mt-4 text-3xl font-bold text-slate-100">{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <label htmlFor="qc-status-filter" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                    id="qc-status-filter"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Inspection</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Receipt</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Result</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Lines</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 animate-pulse">Loading inspections...</td></tr>
                        ) : inspections.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No inspections yet. Post a receipt with "Required — pending" to route it here.</td></tr>
                        ) : inspections.map(i => (
                            <tr key={i.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-200">{i.inspection_number}</div>
                                    <div className="text-xs text-slate-500">{formatters.formatDate(i.created_at)}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">
                                    {i.grn?.grn_number || '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${QC_STATUS_STYLES[i.status] || QC_STATUS_STYLES.pending}`}>
                                        {i.status.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {i.result ? (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${RESULT_STYLES[i.result]}`}>
                                            {i.result}
                                        </span>
                                    ) : <span className="text-slate-600 text-xs">—</span>}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                                    {i.quality_inspection_lines?.length || 0}
                                </td>
                                <td className="px-6 py-4">
                                    {i.status === 'pending' ? (
                                        <button
                                            onClick={() => startInspecting(i)}
                                            className="text-amber-400 hover:text-amber-300 font-semibold text-sm transition-colors"
                                        >
                                            Record Result →
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => navigate(`/procurement/grn/${i.grn_id}`)}
                                            className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors"
                                        >
                                            View Receipt
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showOpenForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">Open Inspection</h2>
                            <button onClick={() => setShowOpenForm(false)} className="text-slate-500 hover:text-slate-50 text-2xl">×</button>
                        </div>
                        <form onSubmit={openInspection} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="qc-grn" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goods Receipt</label>
                                <select
                                    id="qc-grn"
                                    value={grnId}
                                    onChange={e => setGrnId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                                >
                                    <option value="">Select a receipt</option>
                                    {grns.map(g => (
                                        <option key={g.id} value={g.id}>
                                            {g.grn_number} — {g.po?.po_number || 'PO'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <button type="submit" disabled={saving} className="flex-1 px-6 py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-2xl font-bold">
                                    {saving ? 'Opening...' : 'Open Inspection'}
                                </button>
                                <button type="button" onClick={() => setShowOpenForm(false)} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {active && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-100">Record Inspection</h2>
                                <p className="text-sm text-slate-500 mt-1">{active.inspection_number} · {active.grn?.grn_number}</p>
                            </div>
                            <button onClick={() => setActive(null)} className="text-slate-500 hover:text-slate-50 text-2xl">×</button>
                        </div>
                        <form onSubmit={submitResult} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-sm text-amber-300">
                                Only the accepted quantity enters stock — rejected units stay off the books and can be sent back to the vendor.
                            </div>

                            {resultLines.map((l, idx) => (
                                <div key={l.line_id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-100">{l.description}</div>
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                            {l.submitted} submitted
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accepted</label>
                                            <input
                                                type="number" min="0"
                                                aria-label={`Accepted quantity for ${l.description}`}
                                                value={l.accepted_quantity}
                                                onChange={e => updateResult(idx, 'accepted_quantity', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-emerald-400 font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejected</label>
                                            <input
                                                type="number" min="0"
                                                aria-label={`Rejected quantity for ${l.description}`}
                                                value={l.rejected_quantity}
                                                onChange={e => updateResult(idx, 'rejected_quantity', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-center text-rose-400 font-bold"
                                            />
                                        </div>
                                    </div>
                                    {(parseFloat(l.rejected_quantity) || 0) > 0 && (
                                        <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                                            <input
                                                type="text"
                                                placeholder="Defect code"
                                                aria-label={`Defect code for ${l.description}`}
                                                value={l.defect_code}
                                                onChange={e => updateResult(idx, 'defect_code', e.target.value)}
                                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Rejection reason"
                                                aria-label={`Rejection reason for ${l.description}`}
                                                value={l.rejection_reason}
                                                onChange={e => updateResult(idx, 'rejection_reason', e.target.value)}
                                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}

                            <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Totals</span>
                                <span className="text-sm">
                                    <span className="text-emerald-400 font-bold">{totals.accepted} accepted</span>
                                    <span className="text-slate-600 mx-2">·</span>
                                    <span className="text-rose-400 font-bold">{totals.rejected} rejected</span>
                                </span>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="qc-remarks" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inspector Remarks</label>
                                <textarea
                                    id="qc-remarks"
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 text-slate-200 resize-none"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button type="submit" disabled={saving} className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl font-bold">
                                    {saving ? 'Recording...' : 'Record & Release Stock'}
                                </button>
                                <button type="button" onClick={() => setActive(null)} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold">
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

export default QualityInspectionPage;
