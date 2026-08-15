import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../services/procurementService';
import { useInventoryFormatters } from '../utils/formatters';

export type TraceDocType = 'pr' | 'rfq' | 'po' | 'grn' | 'inspection' | 'invoice' | 'return';

const TYPE_META: Record<string, { label: string; icon: string; className: string }> = {
    pr: { label: 'Requisition', icon: '📋', className: 'border-blue-500/30 bg-blue-500/5' },
    rfq: { label: 'RFQ', icon: '📨', className: 'border-cyan-500/30 bg-cyan-500/5' },
    po: { label: 'Purchase Order', icon: '📄', className: 'border-indigo-500/30 bg-indigo-500/5' },
    grn: { label: 'Goods Receipt', icon: '📦', className: 'border-violet-500/30 bg-violet-500/5' },
    inspection: { label: 'Inspection', icon: '🔍', className: 'border-amber-500/30 bg-amber-500/5' },
    invoice: { label: 'Invoice', icon: '🧾', className: 'border-emerald-500/30 bg-emerald-500/5' },
    return: { label: 'Return', icon: '↩️', className: 'border-rose-500/30 bg-rose-500/5' },
};

/**
 * The document's paper trail, rendered as the lifecycle it belongs to.
 *
 * Procurement documents are only meaningful in sequence — an invoice matters
 * because of the receipt behind it — so every screen that shows one can drop
 * this in to let the user walk the whole chain without hunting.
 */
const ProcurementTrace: React.FC<{ type: TraceDocType; id: string }> = ({ type, id }) => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [trace, setTrace] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        // The trail is context, never the point of the page. Anything that
        // goes wrong — including a host that has not wired the client — hides
        // the panel rather than taking the screen down with it.
        try {
            Promise.resolve(procurementService.getDocumentTrace(type, id))
                .then(res => { if (!cancelled) setTrace(res); })
                .catch(err => { if (!cancelled) setError(err?.message || 'Trace unavailable'); });
        } catch (err: any) {
            setError(err?.message || 'Trace unavailable');
        }
        return () => { cancelled = true; };
    }, [type, id]);

    if (error || !trace) return null;

    const chain = trace.chain || [];
    if (chain.length <= 1) return null;

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-400 mb-4">Document Trail</h3>
            <div className="space-y-2">
                {chain.map((node: any) => {
                    const meta = TYPE_META[node.type] || TYPE_META.po;
                    const isFocus = node.type === trace.focus?.type && node.id === trace.focus?.id;
                    return (
                        <button
                            key={`${node.type}-${node.id}`}
                            onClick={() => !isFocus && navigate(node.route)}
                            disabled={isFocus}
                            aria-current={isFocus ? 'step' : undefined}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${meta.className} ${isFocus ? 'ring-1 ring-slate-500 cursor-default' : 'hover:scale-[1.01]'}`}
                        >
                            <span className="text-lg">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{meta.label}</span>
                                    {isFocus && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">You are here</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-100 truncate">{node.label}</div>
                                {node.title && <div className="text-[10px] text-slate-500 truncate">{node.title}</div>}
                            </div>
                            <div className="text-right shrink-0">
                                {node.amount != null && (
                                    <div className="text-sm font-bold text-slate-200">{formatters.formatCurrency(node.amount)}</div>
                                )}
                                <div className="text-[10px] text-slate-500">{node.status}</div>
                                {node.date && <div className="text-[10px] text-slate-600">{formatters.formatDate(node.date)}</div>}
                            </div>
                        </button>
                    );
                })}
            </div>

            {(trace.links?.sales_order_ref || trace.links?.manufacturing_order_id || trace.links?.project_id) && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
                    {trace.links.sales_order_ref && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                            SO {trace.links.sales_order_ref}
                        </span>
                    )}
                    {trace.links.manufacturing_order_id && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border bg-purple-500/10 text-purple-300 border-purple-500/20">
                            Manufacturing Order
                        </span>
                    )}
                    {trace.links.project_id && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
                            Project
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProcurementTrace;
