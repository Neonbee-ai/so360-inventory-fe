import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchService } from '../../services/matchService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Badge, Button, DataTable, EmptyState, ListPageTemplate, getErrorMessage, type BadgeTone, type DataTableColumn } from '@so360/design-system';

export const CASE_STATUS_LABELS: Record<string, string> = {
    pending: 'Pending', matched: 'Matched', exception: 'Exception', on_hold: 'On hold (Finance)', resolved: 'Resolved', cancelled: 'Cancelled',
};
export const CASE_STATUS_TONES: Record<string, BadgeTone> = {
    pending: 'neutral', matched: 'success', exception: 'danger', on_hold: 'warning', resolved: 'success', cancelled: 'neutral',
};
export const OWNER_LABELS: Record<string, string> = {
    procurement: 'Procurement', inventory: 'Inventory / Receiving', quality: 'Quality', requester: 'Requester', finance: 'Finance',
};

/** Work queues: the same list filtered by who has to act. */
const QUEUES = [
    { value: '', label: 'All invoices' },
    { value: 'status:exception', label: 'Needs action' },
    { value: 'status:on_hold', label: 'Invoice holds (Finance)' },
    ...Object.entries(OWNER_LABELS).map(([value, label]) => ({ value: `owner:${value}`, label: `Waiting on ${label}` })),
    { value: 'status:matched', label: 'Matched' },
];

/**
 * Invoice match workbench. Procurement coordinates the match and the exceptions; Finance keeps the invoice, AP,
 * tax posting and payment, so a matched case is never a payment approval.
 */
const MatchWorkbenchPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [queue, setQueue] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        const [kind, value] = queue.split(':');
        const filters = kind === 'status' ? { status: value } : kind === 'owner' ? { owner_module: value } : {};
        Promise.resolve()
            .then(() => matchService.cases(filters))
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch((e: any) => setError(getErrorMessage(e, 'Failed to load match cases')))
            .finally(() => setLoading(false));
    }, [queue]);

    const columns: DataTableColumn<any>[] = [
        {
            key: 'invoice',
            header: 'Invoice',
            alwaysVisible: true,
            render: (r: any) => <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/match-cases/${r.id}`)}>{r.invoice?.invoice_number ?? r.id.slice(0, 8)}</Button>,
        },
        { key: 'po', header: 'Purchase order', render: (r: any) => (r.po ? `#${r.po.po_number}` : '-') },
        { key: 'amount', header: 'Amount', align: 'right', render: (r: any) => (r.invoice?.total_amount != null ? formatters.formatCurrency(r.invoice.total_amount) : '-') },
        { key: 'status', header: 'Match', render: (r: any) => <Badge tone={CASE_STATUS_TONES[r.status] || 'neutral'}>{CASE_STATUS_LABELS[r.status] || r.status}</Badge> },
        { key: 'open', header: 'Open issues', align: 'right', render: (r: any) => r.open_exceptions },
        { key: 'owners', header: 'Waiting on', render: (r: any) => (r.owners?.length ? r.owners.map((o: string) => OWNER_LABELS[o] || o).join(', ') : '-') },
        { key: 'due', header: 'Next due', render: (r: any) => (r.next_due_at ? formatters.formatDate(r.next_due_at) : '-') },
        { key: 'finance', header: 'Finance status', render: (r: any) => (r.finance_status ? String(r.finance_status).replace(/_/g, ' ') : '-') },
    ];

    return (
        <ListPageTemplate
            trail={[]}
            title="Invoice Match"
            description="Supplier invoices matched against the approved PO and accepted receipts. Finance owns the invoice, payables and payment."
            count={rows.length > 0 ? `${rows.length} invoice(s)` : undefined}
            loading={loading && rows.length === 0}
            loadingColumns={columns.length}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title="No invoices to match." description="Invoices captured against a purchase order appear here." />}
            filters={{
                fields: [{ key: 'queue', label: 'Queue', type: 'select', options: QUEUES, default: '' }],
                values: { queue },
                onChange: (v) => setQueue(String(v.queue ?? '')),
                onClear: () => setQueue(''),
            }}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable data-testid="match-cases-table" columns={columns} rows={rows} rowKey={(r: any) => r.id} loading={loading} />
            </div>
        </ListPageTemplate>
    );
};

export default MatchWorkbenchPage;
