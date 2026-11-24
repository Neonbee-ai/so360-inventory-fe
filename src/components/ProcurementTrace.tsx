import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Card, Timeline, type TimelineItem, type TimelineTone } from '@so360/design-system';
import { procurementService } from '../services/procurementService';
import { useInventoryFormatters } from '../utils/formatters';

export type TraceDocType = 'pr' | 'rfq' | 'po' | 'grn' | 'inspection' | 'invoice' | 'return';

const TYPE_META: Record<string, { label: string; icon: string; className: string }> = {
    pr: { label: 'Requisition', icon: '📋', className: 'border-primary/30 bg-primary/5' },
    rfq: { label: 'RFQ', icon: '📨', className: 'border-info/30 bg-info/5' },
    po: { label: 'Purchase Order', icon: '📄', className: 'border-primary/30 bg-primary/5' },
    grn: { label: 'Goods Receipt', icon: '📦', className: 'border-accent/30 bg-accent/5' },
    inspection: { label: 'Inspection', icon: '🔍', className: 'border-warning/30 bg-warning/5' },
    invoice: { label: 'Invoice', icon: '🧾', className: 'border-success/30 bg-success/5' },
    return: { label: 'Return', icon: '↩️', className: 'border-danger/30 bg-danger/5' },
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

    const chain: any[] = trace.chain || [];
    if (chain.length <= 1) return null;

    const toneFor = (status?: string): TimelineTone => {
        const v = String(status || '').toLowerCase();
        if (['passed', 'received', 'posted', 'paid', 'closed', 'completed', 'approved'].includes(v)) return 'success';
        if (['pending', 'in_progress', 'partial', 'draft', 'sent'].includes(v)) return 'warning';
        if (['failed', 'rejected', 'cancelled'].includes(v)) return 'danger';
        return 'neutral';
    };

    // One row per document: reference and type on the title line, status /
    // amount / date underneath — a Timeline entry cannot collide the way the
    // old two-column button cards did.
    const items: TimelineItem[] = chain.map((node: any) => {
        const meta = TYPE_META[node.type] || TYPE_META.po;
        const isFocus = node.type === trace.focus?.type && node.id === trace.focus?.id;
        return {
            id: `${node.type}-${node.id}`,
            icon: <span aria-hidden>{meta.icon}</span>,
            tone: isFocus ? 'primary' : toneFor(node.status),
            title: (
                <span className="flex flex-wrap items-center gap-x-nb-2 gap-y-nb-1 break-words">
                    <span className="text-nb-overline font-bold text-fg-subtle">{meta.label}</span>
                    {isFocus ? (
                        <span className="font-medium text-fg">{node.label}</span>
                    ) : (
                        <Button variant="ghost" size="sm" onClick={() => navigate(node.route)}>{node.label}</Button>
                    )}
                    {isFocus && <Badge tone="primary" size="sm">You are here</Badge>}
                </span>
            ),
            body: (
                <span className="flex flex-col gap-nb-1 break-words">
                    {node.title && <span>{node.title}</span>}
                    <span className="flex flex-wrap items-center gap-x-nb-3 gap-y-nb-1">
                        {node.status && <Badge tone={toneFor(node.status)} size="sm">{String(node.status).replace(/_/g, ' ')}</Badge>}
                        {node.amount != null && <span className="font-medium text-fg">{formatters.formatCurrency(node.amount)}</span>}
                    </span>
                </span>
            ),
            time: node.date ? formatters.formatDate(node.date) : undefined,
            dateTime: node.date || undefined,
        };
    });

    return (
        <Card title="Document Trail">
            <Timeline items={items} name="document-trail" />

            {(trace.links?.sales_order_ref || trace.links?.manufacturing_order_id || trace.links?.project_id) && (
                <div className="mt-nb-4 flex flex-wrap gap-nb-2 border-t border-line pt-nb-4">
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
        </Card>
    );
};

export default ProcurementTrace;
