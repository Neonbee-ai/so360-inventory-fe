import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, AlertCircle, Send, Package,
    Building2, Calendar, Loader2, Scale,
} from 'lucide-react';
import { rfqService } from '../../services/rfqService';
import { vendorService } from '../../services/vendorService';
import { useInventoryFormatters } from '../../utils/formatters';
import { toast, getErrorMessage } from '@so360/design-system';
import { RFQ_STATUS_STYLES } from './RFQListPage';

const VENDOR_STATUS_STYLES: Record<string, string> = {
    invited: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
    quoted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    declined: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    no_response: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const RFQDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rfq, setRfq] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [vendors, setVendors] = useState<any[]>([]);
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [quoteVendor, setQuoteVendor] = useState('');
    const [quoteHeader, setQuoteHeader] = useState({
        quotation_number: '', quotation_date: '', valid_until: '',
        lead_time_days: '', freight_amount: '', payment_terms: '',
        delivery_terms: '', warranty_terms: '', moq_note: '',
    });
    const [quoteLines, setQuoteLines] = useState<any[]>([]);

    useEffect(() => { if (id) fetchRFQ(); }, [id]);

    const fetchRFQ = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await rfqService.getRFQ(id!);
            setRfq(data);
        } catch (err: any) {
            setError(getErrorMessage(err, 'Failed to load RFQ'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!showQuoteForm || vendors.length) return;
        vendorService.getVendors().then((v: any) => setVendors(Array.isArray(v) ? v : [])).catch(() => setVendors([]));
    }, [showQuoteForm]);

    const openQuoteForm = () => {
        // Pre-fill one quotation line per RFQ line so the buyer only types prices.
        setQuoteLines((rfq?.rfq_lines || []).map((l: any) => ({
            rfq_line_id: l.id,
            item_id: l.item_id,
            description: l.description,
            quantity: l.quantity,
            uom: l.uom || '',
            unit_price: '',
            discount_percent: '',
            tax_rate: '',
            lead_time_days: '',
        })));
        setQuoteVendor(rfq?.rfq_vendors?.find((v: any) => v.status === 'invited')?.vendor_id || '');
        setShowQuoteForm(true);
    };

    const handleSend = async () => {
        setBusy('send');
        try {
            await rfqService.sendRFQ(id!);
            toast.success('RFQ sent to invited vendors');
            await fetchRFQ();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to send RFQ'));
        } finally {
            setBusy(null);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm('Cancel this RFQ? Vendors will no longer be able to quote.')) return;
        setBusy('cancel');
        try {
            await rfqService.cancelRFQ(id!);
            toast.success('RFQ cancelled');
            await fetchRFQ();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to cancel RFQ'));
        } finally {
            setBusy(null);
        }
    };

    const handleQuoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quoteVendor) {
            toast.warning('Select the vendor this quotation came from.');
            return;
        }
        const priced = quoteLines.filter(l => parseFloat(String(l.unit_price)) > 0);
        if (priced.length === 0) {
            toast.warning('Enter a unit price on at least one line.');
            return;
        }

        setBusy('quote');
        try {
            await rfqService.recordQuotation(id!, {
                vendor_id: quoteVendor,
                quotation_number: quoteHeader.quotation_number || undefined,
                quotation_date: quoteHeader.quotation_date || undefined,
                valid_until: quoteHeader.valid_until || undefined,
                lead_time_days: quoteHeader.lead_time_days ? parseInt(quoteHeader.lead_time_days, 10) : undefined,
                freight_amount: quoteHeader.freight_amount ? parseFloat(quoteHeader.freight_amount) : undefined,
                payment_terms: quoteHeader.payment_terms || undefined,
                delivery_terms: quoteHeader.delivery_terms || undefined,
                warranty_terms: quoteHeader.warranty_terms || undefined,
                moq_note: quoteHeader.moq_note || undefined,
                items: priced.map(l => ({
                    rfq_line_id: l.rfq_line_id,
                    item_id: l.item_id || undefined,
                    description: l.description || undefined,
                    quantity: parseFloat(String(l.quantity)),
                    unit_price: parseFloat(String(l.unit_price)),
                    uom: l.uom || undefined,
                    discount_percent: l.discount_percent ? parseFloat(String(l.discount_percent)) : undefined,
                    tax_rate: l.tax_rate ? parseFloat(String(l.tax_rate)) : undefined,
                    lead_time_days: l.lead_time_days ? parseInt(String(l.lead_time_days), 10) : undefined,
                })),
            });
            toast.success('Quotation recorded');
            setShowQuoteForm(false);
            setQuoteHeader({
                quotation_number: '', quotation_date: '', valid_until: '',
                lead_time_days: '', freight_amount: '', payment_terms: '',
                delivery_terms: '', warranty_terms: '', moq_note: '',
            });
            await fetchRFQ();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to record quotation'));
        } finally {
            setBusy(null);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !rfq) {
        return (
            <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-50 mb-2">{error || 'RFQ not found'}</h2>
                <button onClick={() => navigate('/procurement/rfq')} className="text-blue-400 hover:underline">
                    Back to RFQs
                </button>
            </div>
        );
    }

    const quotations = rfq.vendor_quotations || [];

    return (
        <div className="p-8">
            <button
                onClick={() => navigate('/procurement/rfq')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-50 mb-6 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to RFQs
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                                <FileText size={28} className="text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-50">{rfq.rfq_number}</h1>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${RFQ_STATUS_STYLES[rfq.status] || RFQ_STATUS_STYLES.draft}`}>
                                    {rfq.status}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {rfq.title && (
                                <div className="p-3 bg-slate-800/30 rounded-xl">
                                    <span className="text-xs text-slate-500 block">Title</span>
                                    <span className="text-sm text-slate-50">{rfq.title}</span>
                                </div>
                            )}
                            {rfq.pr_id && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <FileText size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Source Requisition</span>
                                        <button onClick={() => navigate(`/procurement/pr/${rfq.pr_id}`)} className="text-sm text-blue-400 hover:text-blue-300">
                                            View requisition
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                <Calendar size={16} className="text-slate-500" />
                                <div>
                                    <span className="text-xs text-slate-500 block">Response Due</span>
                                    <span className="text-sm text-slate-50">
                                        {rfq.response_due_date ? formatters.formatDate(rfq.response_due_date) : 'Not set'}
                                    </span>
                                </div>
                            </div>
                            {rfq.po_id && (
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <Package size={16} className="text-emerald-400" />
                                    <div>
                                        <span className="text-xs text-emerald-300/70 block">Awarded — Purchase Order</span>
                                        <button onClick={() => navigate(`/procurement/po/${rfq.po_id}`)} className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold">
                                            View purchase order
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
                            {['draft', 'sent'].includes(rfq.status) && (
                                <button
                                    onClick={handleSend}
                                    disabled={busy === 'send'}
                                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {rfq.status === 'draft' ? 'Send to Vendors' : 'Send to New Vendors'}
                                </button>
                            )}
                            {!['awarded', 'cancelled'].includes(rfq.status) && (
                                <button
                                    onClick={openQuoteForm}
                                    className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors"
                                >
                                    Record Quotation
                                </button>
                            )}
                            {quotations.length > 0 && (
                                <button
                                    onClick={() => navigate(`/procurement/rfq/${rfq.id}/compare`)}
                                    className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Scale size={16} /> Compare &amp; Award
                                </button>
                            )}
                            {!['awarded', 'cancelled'].includes(rfq.status) && (
                                <button
                                    onClick={handleCancel}
                                    disabled={busy === 'cancel'}
                                    className="w-full px-4 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold transition-colors"
                                >
                                    Cancel RFQ
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                            <Building2 size={16} /> Invited Vendors
                        </h3>
                        {(rfq.rfq_vendors || []).length === 0 ? (
                            <p className="text-xs text-slate-500">No vendors invited yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {rfq.rfq_vendors.map((v: any) => (
                                    <div key={v.id} className="flex items-center justify-between gap-3 p-3 bg-slate-800/30 rounded-xl">
                                        <div className="min-w-0">
                                            <div className="text-sm text-slate-100 truncate">{v.vendor_name || v.vendor_id.slice(0, 8)}</div>
                                            {v.contact_email && <div className="text-[10px] text-slate-500 truncate">{v.contact_email}</div>}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${VENDOR_STATUS_STYLES[v.status] || VENDOR_STATUS_STYLES.invited}`}>
                                            {v.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
                            <Package size={20} className="text-cyan-400" /> Requested Lines
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                        <th className="pb-3">Item</th>
                                        <th className="pb-3 text-center">Quantity</th>
                                        <th className="pb-3 text-center">UOM</th>
                                        <th className="pb-3 text-right">Target Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(rfq.rfq_lines || []).map((l: any) => (
                                        <tr key={l.id} className="border-b border-slate-800/50">
                                            <td className="py-3 text-slate-50">{l.description || l.item_id?.slice(0, 8) || 'Item'}</td>
                                            <td className="py-3 text-center text-slate-300">{l.quantity}</td>
                                            <td className="py-3 text-center text-slate-400">{l.uom || '—'}</td>
                                            <td className="py-3 text-right text-slate-300">
                                                {l.target_unit_price != null ? formatters.formatCurrency(l.target_unit_price) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-slate-50 mb-4">Quotations Received</h2>
                        {quotations.length === 0 ? (
                            <p className="text-sm text-slate-500">No quotations yet. Record one as vendors respond.</p>
                        ) : (
                            <div className="space-y-3">
                                {quotations.map((q: any) => (
                                    <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-semibold text-slate-100">{q.vendor_name || q.vendor_id.slice(0, 8)}</div>
                                            <div className="text-xs text-slate-500">
                                                {q.quotation_number || 'No quote ref'}
                                                {q.lead_time_days != null && ` · ${q.lead_time_days} day lead time`}
                                                {q.valid_until && ` · valid to ${formatters.formatDate(q.valid_until)}`}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-slate-50">{formatters.formatCurrency(q.total_amount || 0)}</div>
                                            <span className={`text-[10px] font-bold uppercase ${q.status === 'awarded' ? 'text-emerald-400' : q.status === 'rejected' ? 'text-rose-400' : 'text-slate-500'}`}>
                                                {q.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showQuoteForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">Record Quotation</h2>
                            <button onClick={() => setShowQuoteForm(false)} className="text-slate-500 hover:text-slate-50 text-2xl">×</button>
                        </div>
                        <form onSubmit={handleQuoteSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="q-vendor" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</label>
                                    <select
                                        id="q-vendor"
                                        value={quoteVendor}
                                        onChange={e => setQuoteVendor(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                                    >
                                        <option value="">Select vendor</option>
                                        {(rfq.rfq_vendors || []).map((v: any) => (
                                            <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name || v.vendor_id.slice(0, 8)}</option>
                                        ))}
                                        {vendors
                                            .filter(v => !(rfq.rfq_vendors || []).some((rv: any) => rv.vendor_id === v.id))
                                            .map(v => <option key={v.id} value={v.id}>{v.name} (not invited)</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-number" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quotation Ref</label>
                                    <input id="q-number" type="text" value={quoteHeader.quotation_number}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, quotation_number: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-valid" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valid Until</label>
                                    <input id="q-valid" type="date" value={quoteHeader.valid_until}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, valid_until: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-lead" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Time (days)</label>
                                    <input id="q-lead" type="number" min="0" value={quoteHeader.lead_time_days}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, lead_time_days: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-freight" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Freight</label>
                                    <input id="q-freight" type="number" min="0" step="0.01" value={quoteHeader.freight_amount}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, freight_amount: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-payment" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Terms</label>
                                    <input id="q-payment" type="text" value={quoteHeader.payment_terms}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, payment_terms: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-warranty" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warranty</label>
                                    <input id="q-warranty" type="text" value={quoteHeader.warranty_terms}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, warranty_terms: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="q-moq" className="text-xs font-bold text-slate-500 uppercase tracking-wider">MOQ Conditions</label>
                                    <input id="q-moq" type="text" value={quoteHeader.moq_note}
                                        onChange={e => setQuoteHeader({ ...quoteHeader, moq_note: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quoted Prices</label>
                                {quoteLines.map((l, idx) => (
                                    <div key={l.rfq_line_id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-slate-200 truncate">{l.description || 'Line'}</div>
                                            <div className="text-[10px] text-slate-500">Qty {l.quantity} {l.uom}</div>
                                        </div>
                                        <input
                                            type="number" min="0" step="0.01"
                                            aria-label={`Unit price for ${l.description || `line ${idx + 1}`}`}
                                            placeholder="Unit price"
                                            value={l.unit_price}
                                            onChange={e => {
                                                const next = [...quoteLines];
                                                next[idx] = { ...next[idx], unit_price: e.target.value };
                                                setQuoteLines(next);
                                            }}
                                            className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-emerald-400 font-bold text-center"
                                        />
                                        <input
                                            type="number" min="0" step="0.01"
                                            aria-label={`Tax rate for ${l.description || `line ${idx + 1}`}`}
                                            placeholder="Tax %"
                                            value={l.tax_rate}
                                            onChange={e => {
                                                const next = [...quoteLines];
                                                next[idx] = { ...next[idx], tax_rate: e.target.value };
                                                setQuoteLines(next);
                                            }}
                                            className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 text-center"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button type="submit" disabled={busy === 'quote'}
                                    className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl font-bold transition-all">
                                    {busy === 'quote' ? 'Saving...' : 'Save Quotation'}
                                </button>
                                <button type="button" onClick={() => setShowQuoteForm(false)}
                                    className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all">
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

export default RFQDetailPage;
