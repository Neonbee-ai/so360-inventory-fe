import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from '@so360/design-system';
import { procurementService } from '../services/procurementService';
import { useInventoryFormatters } from '../utils/formatters';

export type TraceDocType = 'pr' | 'rfq' | 'po' | 'grn' | 'inspection' | 'invoice' | 'return';

const TYPE_META: Record<string, { label: string; icon: string; className: string }> = {
    pr: { label: 'Requisition', icon: '📋', className: 'border-primary/30 bg-primary/5' },
    rfq: { label: 'RFQ', icon: '📨', className: 'border-cyan-500/30 bg-cyan-500/5' },
    po: { label: 'Purchase Order', icon: '📄', className: 'border-primary/30 bg-primary/5' },
    grn: { label: 'Goods Receipt', icon: '📦', className: 'border-violet-500/30 bg-violet-500/5' },
    inspection: { label: 'Inspection', icon: '🔍', className: 'border-warning/30 bg-warning/5' },
    invoice: { label: 'Invoice', icon: '🧾', className: 'border-success/30 bg-success/5' },
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
        <div className="bg-surface/50 border border-line rounded-2xl p-6">
            <h3 className="text-sm font-bold text-fg-muted mb-4">Document Trail</h3>
            <div className="space-y-2">
                {chain.map((node: any) => {
                    const meta = TYPE_META[node.type] || TYPE_META.po;
                    const isFocus = node.type === trace.focus?.type && node.id === trace.focus?.id;
                    return (
                        <Button
                            key={`${node.type}-${node.id}`}
                            variant="ghost"
                            onClick={() => !isFocus && navigate(node.route)}
                            disabled={isFocus}
                            aria-current={isFocus ? 'step' : undefined}
                            className={`w-full justify-start gap-nb-3 text-left ${meta.className}`}
                        >
                            <span className="text-lg">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-fg-subtle">{meta.label}</span>
                                    {isFocus && (
                                        <span className="text-[9px] font-bold text-fg-muted">You are here</span>
                                    )}
                                </div>
                                <div className="text-sm text-fg truncate">{node.label}</div>
                                {node.title && <div className="text-[10px] text-fg-subtle truncate">{node.title}</div>}
                            </div>
                            <div className="text-right shrink-0">
                                {node.amount != null && (
                                    <div className="text-sm font-bold text-fg">{formatters.formatCurrency(node.amount)}</div>
                                )}
                                <div className="text-[10px] text-fg-subtle">{node.status}</div>
                                {node.date && <div className="text-[10px] text-fg-subtle">{formatters.formatDate(node.date)}</div>}
                            </div>
                        </Button>
                    );
                })}
            </div>

            {(trace.links?.sales_order_ref || trace.links?.manufacturing_order_id || trace.links?.project_id) && (
                <div className="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">
                    {trace.links.sales_order_ref && (
                        <Badge tone="success" size="sm">SO {trace.links.sales_order_ref}</Badge>
                    )}
                    {trace.links.manufacturing_order_id && (
                        <Badge tone="info" size="sm">Manufacturing Order</Badge>
                    )}
                    {trace.links.project_id && (
                        <Badge tone="info" size="sm">Project</Badge>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProcurementTrace;
