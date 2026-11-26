import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { receivingService } from '../../services/receivingService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Badge, Button, DataTable, EmptyState, ListPageTemplate, Select, getErrorMessage, type BadgeTone, type DataTableColumn } from '@so360/design-system';

const STATUS_LABELS: Record<string, string> = {
    expected: 'Expected', partially_received: 'Partially received', received: 'Received', cancelled: 'Cancelled', superseded: 'Superseded',
};
const STATUS_TONES: Record<string, BadgeTone> = {
    expected: 'primary', partially_received: 'warning', received: 'success', cancelled: 'neutral', superseded: 'neutral',
};
const STATUS_OPTIONS = [{ value: '', label: 'All' }, ...['expected', 'partially_received', 'received'].map(v => ({ value: v, label: STATUS_LABELS[v] }))];

/**
 * Expected receipts: what the supplier has confirmed will arrive. A notice is not a receipt and not stock;
 * receiving starts a goods receipt prefilled from the notice.
 */
const ExpectedReceiptsPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        Promise.resolve()
            .then(() => receivingService.expectedReceipts(status ? { status } : {}))
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch((e: any) => setError(getErrorMessage(e, 'Failed to load expected receipts')))
            .finally(() => setLoading(false));
    }, [status]);

    const columns: DataTableColumn<any>[] = [
        {
            key: 'po',
            header: 'Purchase order',
            alwaysVisible: true,
            render: (r: any) => <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/po/${r.po_id}`)}>#{r.po?.po_number ?? r.po_id?.slice(0, 8)}</Button>,
        },
        { key: 'due', header: 'Due', render: (r: any) => (r.due_date ? formatters.formatDate(r.due_date) : '-') },
        { key: 'qty', header: 'Expected', align: 'right', render: (r: any) => r.quantity },
        { key: 'received', header: 'Accepted', align: 'right', render: (r: any) => r.accepted_qty ?? 0 },
        { key: 'pending', header: 'In inspection', align: 'right', render: (r: any) => r.pending_inspection_qty ?? 0 },
        { key: 'quarantined', header: 'Quarantined', align: 'right', render: (r: any) => r.quarantined_qty ?? 0 },
        { key: 'open', header: 'Open', align: 'right', render: (r: any) => r.open_qty ?? r.quantity },
        {
            key: 'dest',
            header: 'Destination',
            render: (r: any) => (
                <span className="inline-flex flex-wrap gap-1">
                    <span>{r.direct_to_site ? 'Direct to site' : 'Warehouse'}</span>
                    {r.inspection_required && <Badge tone="warning">Inspection</Badge>}
                    {r.lot_serial_required && <Badge tone="neutral">Lot / serial</Badge>}
                </span>
            ),
        },
        { key: 'status', header: 'Status', render: (r: any) => <Badge tone={STATUS_TONES[r.status] || 'neutral'}>{STATUS_LABELS[r.status] || r.status}</Badge> },
        {
            key: 'action',
            header: 'Action',
            render: (r: any) => (['expected', 'partially_received'].includes(r.status)
                ? <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/grn/new?expected_receipt_id=${r.id}`)}>Receive</Button>
                : <span className="text-fg-subtle">-</span>),
        },
    ];

    return (
        <ListPageTemplate
            trail={[]}
            title="Expected Receipts"
            description="Deliveries the supplier has confirmed. A notice is not stock; receive it to post a goods receipt."
            count={rows.length > 0 ? `${rows.length} expected` : undefined}
            loading={loading && rows.length === 0}
            loadingColumns={columns.length}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title="No expected receipts." description="Notices appear when a supplier confirms a delivery schedule." />}
            filters={<Select name="expected-receipt-status" label="Status" value={status} options={STATUS_OPTIONS} onChange={(e: any) => setStatus(e?.target ? e.target.value : e)} />}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable data-testid="expected-receipts-table" columns={columns} rows={rows} rowKey={(r: any) => r.id} loading={loading} />
            </div>
        </ListPageTemplate>
    );
};

export default ExpectedReceiptsPage;
