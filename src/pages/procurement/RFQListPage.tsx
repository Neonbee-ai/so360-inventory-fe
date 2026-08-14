import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfqService } from '../../services/rfqService';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { useInventoryFormatters } from '../../utils/formatters';
import { toast, getErrorMessage } from '@so360/design-system';

interface RFQ {
    id: string;
    rfq_number: string;
    title?: string;
    status: string;
    response_due_date?: string;
    required_date?: string;
    created_at: string;
    line_count: number;
    vendor_count: number;
    quotation_count: number;
}

export const RFQ_STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
    sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    closed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    awarded: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const EMPTY_FORM = {
    title: '',
    description: '',
    pr_id: '',
    response_due_date: '',
    required_date: '',
    payment_terms: '',
    delivery_terms: '',
    incoterms: '',
};

const RFQListPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rfqs, setRfqs] = useState<RFQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [lines, setLines] = useState<any[]>([]);
    const [vendorIds, setVendorIds] = useState<string[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [approvedPRs, setApprovedPRs] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchData(); }, [statusFilter]);

    const fetchData = async () => {
        try {
            setFetchError(null);
            const data = await rfqService.getRFQs(statusFilter ? { status: statusFilter } : {});
            setRfqs(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(getErrorMessage(err, 'Failed to load RFQs'));
        } finally {
            setLoading(false);
        }
    };

    // Vendors and approved requisitions are only needed by the create form.
    useEffect(() => {
        if (!showForm || vendors.length) return;
        Promise.all([
            vendorService.getVendors().catch(() => []),
            procurementService.getPRs().catch(() => []),
        ]).then(([v, prs]) => {
            setVendors(Array.isArray(v) ? v : []);
            const list = Array.isArray(prs) ? prs : ((prs as any)?.data || []);
            setApprovedPRs(list.filter((p: any) => ['approved', 'partially_converted'].includes(p.status)));
        });
    }, [showForm]);

    const addLine = () => setLines([...lines, { item_id: '', _selectedName: '', description: '', quantity: 1, uom: '', target_unit_price: '' }]);

    const updateLine = (idx: number, field: string, value: any) => {
        const next = [...lines];
        next[idx] = { ...next[idx], [field]: value };
        setLines(next);
    };

    const toggleVendor = (id: string) =>
        setVendorIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Lines may come from the linked requisition instead of being typed.
        if (!form.pr_id && lines.length === 0) {
            toast.warning('Add at least one line, or link a requisition to copy its lines.');
            return;
        }
        if (lines.some(l => !(parseFloat(String(l.quantity)) > 0))) {
            toast.warning('Every line needs a quantity greater than 0.');
            return;
        }

        setSaving(true);
        try {
            const created = await rfqService.createRFQ({
                title: form.title || undefined,
                description: form.description || undefined,
                pr_id: form.pr_id || undefined,
                response_due_date: form.response_due_date || undefined,
                required_date: form.required_date || undefined,
                payment_terms: form.payment_terms || undefined,
                delivery_terms: form.delivery_terms || undefined,
                incoterms: form.incoterms || undefined,
                vendor_ids: vendorIds.length ? vendorIds : undefined,
                items: lines.length ? lines.map(l => ({
                    item_id: l.item_id || undefined,
                    description: l.description || undefined,
                    quantity: parseFloat(String(l.quantity)),
                    uom: l.uom || undefined,
                    target_unit_price: l.target_unit_price ? parseFloat(String(l.target_unit_price)) : undefined,
                })) : undefined,
            });
            toast.success(`RFQ ${created?.rfq_number || ''} created`);
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
            setLines([]);
            setVendorIds([]);
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to create RFQ'));
        } finally {
            setSaving(false);
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
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Requests for Quotation
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Source competitive quotes before committing to a purchase order.</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                >
                    <span className="text-xl leading-none">+</span> New RFQ
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total RFQs', value: rfqs.length, icon: '📄' },
                    { label: 'Awaiting Quotes', value: rfqs.filter(r => r.status === 'sent').length, icon: '⏳' },
                    { label: 'Quotes Received', value: rfqs.reduce((s, r) => s + (r.quotation_count || 0), 0), icon: '💬' },
                    { label: 'Awarded', value: rfqs.filter(r => r.status === 'awarded').length, icon: '🏆' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{stat.icon}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                        </div>
                        <div className="mt-4 text-3xl font-bold text-slate-100">{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <label htmlFor="rfq-status-filter" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                    id="rfq-status-filter"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="awarded">Awarded</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">RFQ</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Vendors</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Quotes</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Response Due</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 animate-pulse">Loading RFQs...</td></tr>
                        ) : rfqs.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No RFQs yet. Create one to start sourcing quotes.</td></tr>
                        ) : rfqs.map(rfq => (
                            <tr key={rfq.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-200">{rfq.rfq_number}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[220px]">{rfq.title || `${rfq.line_count} lines`}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${RFQ_STATUS_STYLES[rfq.status] || RFQ_STATUS_STYLES.draft}`}>
                                        {rfq.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300 font-mono">{rfq.vendor_count}</td>
                                <td className="px-6 py-4 text-sm font-mono">
                                    <span className={rfq.quotation_count > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                        {rfq.quotation_count}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">
                                    {rfq.response_due_date ? formatters.formatDate(rfq.response_due_date) : '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => navigate(`/procurement/rfq/${rfq.id}`)}
                                            className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors"
                                        >
                                            View Details →
                                        </button>
                                        {rfq.quotation_count > 1 && (
                                            <button
                                                onClick={() => navigate(`/procurement/rfq/${rfq.id}/compare`)}
                                                className="text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors"
                                            >
                                                Compare
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600] animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden shadow-2xl shadow-black/50">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">New Request for Quotation</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-50 transition-colors text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="rfq-title" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Title</label>
                                    <input
                                        id="rfq-title"
                                        type="text"
                                        value={form.title}
                                        placeholder="e.g. Q4 cement supply"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="rfq-pr" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source Requisition</label>
                                    <select
                                        id="rfq-pr"
                                        value={form.pr_id}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        onChange={e => setForm({ ...form, pr_id: e.target.value })}
                                    >
                                        <option value="">Not from a requisition</option>
                                        {approvedPRs.map(pr => (
                                            <option key={pr.id} value={pr.id}>
                                                {pr.pr_number || pr.id.slice(0, 8)} — {pr.title || pr.description || 'Requisition'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="rfq-due" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Response Due</label>
                                    <input
                                        id="rfq-due"
                                        type="date"
                                        value={form.response_due_date}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        onChange={e => setForm({ ...form, response_due_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="rfq-required" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goods Required By</label>
                                    <input
                                        id="rfq-required"
                                        type="date"
                                        value={form.required_date}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        onChange={e => setForm({ ...form, required_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="rfq-payment" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Terms</label>
                                    <input
                                        id="rfq-payment"
                                        type="text"
                                        value={form.payment_terms}
                                        placeholder="e.g. Net 30"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        onChange={e => setForm({ ...form, payment_terms: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="rfq-incoterms" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Incoterms</label>
                                    <input
                                        id="rfq-incoterms"
                                        type="text"
                                        value={form.incoterms}
                                        placeholder="e.g. DDP"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        onChange={e => setForm({ ...form, incoterms: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invite Vendors</label>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {vendors.length === 0 && <span className="text-sm text-slate-600">No vendors found.</span>}
                                    {vendors.map(v => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            aria-pressed={vendorIds.includes(v.id)}
                                            onClick={() => toggleVendor(v.id)}
                                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${vendorIds.includes(v.id)
                                                ? 'bg-blue-600/10 text-blue-400 border-blue-500/40'
                                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                                        >
                                            {v.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested Lines</label>
                                    <button type="button" onClick={addLine} className="text-blue-400 hover:text-blue-300 text-xs font-bold">+ Add Line</button>
                                </div>
                                {lines.length === 0 && (
                                    <div className="text-center py-6 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
                                        {form.pr_id
                                            ? 'Lines will be copied from the selected requisition.'
                                            : 'No lines yet. Click "+ Add Line" or link a requisition.'}
                                    </div>
                                )}
                                {lines.map((line, idx) => (
                                    <div key={idx} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
                                        <div className="flex gap-3 items-center">
                                            <div className="flex-1">
                                                <ItemSearchSelector
                                                    value={line.item_id}
                                                    selectedName={line._selectedName}
                                                    onSelect={(selected: any) => {
                                                        const next = [...lines];
                                                        next[idx] = {
                                                            ...next[idx],
                                                            item_id: selected.id,
                                                            _selectedName: `${selected.name} (${selected.sku})`,
                                                            target_unit_price: selected.price ?? next[idx].target_unit_price,
                                                        };
                                                        setLines(next);
                                                    }}
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                aria-label={`Quantity for line ${idx + 1}`}
                                                placeholder="Qty"
                                                min="1"
                                                value={line.quantity}
                                                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                                                onChange={e => updateLine(idx, 'quantity', e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                aria-label={`Unit of measure for line ${idx + 1}`}
                                                placeholder="UOM"
                                                value={line.uom}
                                                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                                                onChange={e => updateLine(idx, 'uom', e.target.value)}
                                            />
                                            <input
                                                type="number"
                                                aria-label={`Target price for line ${idx + 1}`}
                                                placeholder="Target"
                                                value={line.target_unit_price}
                                                className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                                                onChange={e => updateLine(idx, 'target_unit_price', e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                                                className="text-red-400 hover:text-red-300 text-lg font-bold px-2"
                                                title="Remove line"
                                            >×</button>
                                        </div>
                                        <input
                                            type="text"
                                            aria-label={`Description for line ${idx + 1}`}
                                            placeholder="Description / specification (optional)"
                                            value={line.description}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600"
                                            onChange={e => updateLine(idx, 'description', e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                                >
                                    {saving ? 'Creating...' : 'Create RFQ'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all active:scale-95">
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

export default RFQListPage;
