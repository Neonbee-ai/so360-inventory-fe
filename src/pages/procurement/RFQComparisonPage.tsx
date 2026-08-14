import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Trophy, Loader2, Clock, Star, TrendingDown } from 'lucide-react';
import { rfqService } from '../../services/rfqService';
import { useInventoryFormatters } from '../../utils/formatters';
import { toast, getErrorMessage } from '@so360/design-system';

/**
 * Side-by-side quotation comparison.
 *
 * Price alone rarely decides a purchase, so every commercial axis a buyer
 * weighs — landed total, lead time, terms, warranty, MOQ and the vendor's own
 * performance rating — gets its own row, with the best value in each badged.
 */
const RFQComparisonPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [awarding, setAwarding] = useState<string | null>(null);
    const [justification, setJustification] = useState('');

    useEffect(() => { if (id) fetchComparison(); }, [id]);

    const fetchComparison = async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await rfqService.getComparison(id!));
        } catch (err: any) {
            setError(getErrorMessage(err, 'Failed to load comparison'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAward = async (quotationId: string, vendorName: string) => {
        if (!window.confirm(`Award this RFQ to ${vendorName}? A purchase order will be created.`)) return;
        setAwarding(quotationId);
        try {
            const result = await rfqService.awardRFQ(id!, {
                quotation_id: quotationId,
                justification: justification || undefined,
            });
            toast.success(`Awarded to ${vendorName} — PO ${result?.po?.po_number || ''} created`);
            navigate(`/procurement/po/${result.po.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to award RFQ'));
            setAwarding(null);
        }
    };

    const handleGrade = async (quotationId: string, status: 'shortlisted' | 'rejected') => {
        try {
            await rfqService.gradeQuotation(quotationId, { status });
            toast.success(status === 'shortlisted' ? 'Quotation shortlisted' : 'Quotation rejected');
            await fetchComparison();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to update quotation'));
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-50 mb-2">{error || 'Comparison unavailable'}</h2>
                <button onClick={() => navigate('/procurement/rfq')} className="text-blue-400 hover:underline">Back to RFQs</button>
            </div>
        );
    }

    const { rfq, lines, quotations, summary } = data;
    const isAwarded = rfq.status === 'awarded';

    return (
        <div className="p-8 space-y-8">
            <button
                onClick={() => navigate(`/procurement/rfq/${id}`)}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to RFQ
            </button>

            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Quotation Comparison
                </h1>
                <p className="text-slate-400 mt-2 font-medium">
                    {rfq.rfq_number}{rfq.title ? ` — ${rfq.title}` : ''}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Vendors Invited', value: summary.invited_count },
                    { label: 'Quotes Received', value: summary.quotation_count },
                    { label: 'Lowest Total', value: summary.lowest_total != null ? formatters.formatCurrency(summary.lowest_total) : '—' },
                    { label: 'Potential Saving', value: formatters.formatCurrency(summary.potential_saving || 0) },
                ].map((s, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                        <div className="mt-3 text-2xl font-bold text-slate-100">{s.value}</div>
                    </div>
                ))}
            </div>

            {quotations.length === 0 ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                    No quotations to compare yet.
                </div>
            ) : (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-800/30">
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400 sticky left-0 bg-slate-900">Criterion</th>
                                    {quotations.map((q: any) => (
                                        <th key={q.quotation_id} className="px-6 py-4 text-left min-w-[220px]">
                                            <div className="font-bold text-slate-100">{q.vendor_name || q.vendor_id.slice(0, 8)}</div>
                                            <div className="text-[10px] text-slate-500 font-normal">{q.quotation_number || 'No ref'}</div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {q.is_lowest_total && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                        <TrendingDown size={10} /> Lowest
                                                    </span>
                                                )}
                                                {q.is_fastest && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                                        <Clock size={10} /> Fastest
                                                    </span>
                                                )}
                                                {q.is_best_rated && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                                        <Star size={10} /> Top rated
                                                    </span>
                                                )}
                                                {q.is_expired && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        Expired
                                                    </span>
                                                )}
                                                {q.status === 'awarded' && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                        Awarded
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {[
                                    { label: 'Subtotal', render: (q: any) => formatters.formatCurrency(q.subtotal_amount) },
                                    { label: 'Tax', render: (q: any) => formatters.formatCurrency(q.tax_amount) },
                                    { label: 'Freight', render: (q: any) => formatters.formatCurrency(q.freight_amount) },
                                    { label: 'Discount', render: (q: any) => formatters.formatCurrency(q.discount_amount) },
                                    {
                                        label: 'Landed Total',
                                        render: (q: any) => (
                                            <span className={`font-bold text-base ${q.is_lowest_total ? 'text-emerald-400' : 'text-slate-100'}`}>
                                                {formatters.formatCurrency(q.total_amount)}
                                            </span>
                                        ),
                                    },
                                    { label: 'Lead Time', render: (q: any) => q.lead_time_days != null ? `${q.lead_time_days} days` : '—' },
                                    { label: 'Payment Terms', render: (q: any) => q.payment_terms || '—' },
                                    { label: 'Delivery Terms', render: (q: any) => q.delivery_terms || '—' },
                                    { label: 'Incoterms', render: (q: any) => q.incoterms || '—' },
                                    { label: 'Warranty', render: (q: any) => q.warranty_terms || '—' },
                                    { label: 'MOQ', render: (q: any) => q.moq_note || '—' },
                                    { label: 'Valid Until', render: (q: any) => q.valid_until ? formatters.formatDate(q.valid_until) : '—' },
                                    {
                                        label: 'Quality Rating',
                                        render: (q: any) => q.quality_rating != null ? `${Number(q.quality_rating).toFixed(1)} / 5` : '—',
                                    },
                                ].map(row => (
                                    <tr key={row.label} className="hover:bg-slate-800/20">
                                        <td className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-900">{row.label}</td>
                                        {quotations.map((q: any) => (
                                            <td key={q.quotation_id} className="px-6 py-3 text-slate-300">{row.render(q)}</td>
                                        ))}
                                    </tr>
                                ))}

                                {lines.map((l: any) => (
                                    <tr key={l.rfq_line_id} className="hover:bg-slate-800/20">
                                        <td className="px-6 py-3 sticky left-0 bg-slate-900">
                                            <div className="text-xs text-slate-300">{l.description || 'Line'}</div>
                                            <div className="text-[10px] text-slate-600">
                                                {l.quantity} {l.uom || ''}
                                                {l.target_unit_price != null && ` · target ${formatters.formatCurrency(l.target_unit_price)}`}
                                            </div>
                                        </td>
                                        {quotations.map((q: any) => {
                                            const cell = q.lines[l.rfq_line_id];
                                            const isLowest = cell && l.lowest_unit_price != null && cell.unit_price === l.lowest_unit_price;
                                            return (
                                                <td key={q.quotation_id} className="px-6 py-3">
                                                    {cell ? (
                                                        <span className={isLowest ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                                                            {formatters.formatCurrency(cell.unit_price)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600">Not quoted</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}

                                {!isAwarded && (
                                    <tr>
                                        <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-900">Decision</td>
                                        {quotations.map((q: any) => (
                                            <td key={q.quotation_id} className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => handleAward(q.quotation_id, q.vendor_name || 'this vendor')}
                                                        disabled={!!awarding || q.is_expired}
                                                        title={q.is_expired ? 'This quotation has expired' : undefined}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        {awarding === q.quotation_id ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />}
                                                        Award
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleGrade(q.quotation_id, 'shortlisted')}
                                                            className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                                        >
                                                            Shortlist
                                                        </button>
                                                        <button
                                                            onClick={() => handleGrade(q.quotation_id, 'rejected')}
                                                            className="flex-1 px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!isAwarded && quotations.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-2">
                    <label htmlFor="award-justification" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Award Justification
                    </label>
                    <textarea
                        id="award-justification"
                        value={justification}
                        onChange={e => setJustification(e.target.value)}
                        placeholder="Recorded on the RFQ — required in practice whenever the cheapest quote is not the one awarded."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    />
                </div>
            )}
        </div>
    );
};

export default RFQComparisonPage;
