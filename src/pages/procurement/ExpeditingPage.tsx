import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { poScheduleService } from '../../services/poScheduleService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Badge, Button, DataTable, EmptyState, ListPageTemplate, Select, getErrorMessage, type DataTableColumn } from '@so360/design-system';

const REASON_LABELS: Record<string, string> = {
    overdue_ack: 'Acknowledgement overdue', at_risk: 'At risk', overdue_delivery: 'Delivery overdue', follow_up_due: 'Follow-up due',
};
const VIEWS = [{ value: '', label: 'All' }, ...Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }))];

/** Expediting queue: what a buyer should chase today (overdue acknowledgements, at-risk and late deliveries, follow-ups due). */
const ExpeditingPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        Promise.resolve().then(() => poScheduleService.expediting(view || undefined)).then(d => setRows(Array.isArray(d) ? d : [])).catch((e: any) => setError(getErrorMessage(e, 'Failed to load the expediting queue'))).finally(() => setLoading(false));
    }, [view]);

    const columns: DataTableColumn<any>[] = [
        { key: 'po', header: 'PO', render: (r: any) => <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/po/${r.po_id}`)}>#{r.po_number}</Button> },
        { key: 'why', header: 'Why', render: (r: any) => <span className="inline-flex flex-wrap gap-1">{r.reasons.map((x: string) => <Badge key={x} tone={x === 'at_risk' || x === 'overdue_delivery' ? 'danger' : 'warning'}>{REASON_LABELS[x] || x}</Badge>)}</span> },
        { key: 'ack', header: 'Response', render: (r: any) => String(r.ack_status || 'pending').replace(/_/g, ' ') },
        { key: 'fc', header: 'Forecast', render: (r: any) => (r.forecast_date ? formatters.formatDate(r.forecast_date) : '-') },
        { key: 'qty', header: 'Ordered', align: 'right', render: (r: any) => r.ordered_qty },
        { key: 'cause', header: 'Delay cause', render: (r: any) => (r.delay_cause ? String(r.delay_cause).replace(/_/g, ' ') : '-') },
        { key: 'next', header: 'Next follow-up', render: (r: any) => (r.next_follow_up_at ? formatters.formatDateTime(r.next_follow_up_at) : '-') },
    ];

    return (
        <ListPageTemplate
            trail={[]}
            title="Expediting"
            description="Purchase order schedules a buyer should chase: overdue acknowledgements, at-risk and late deliveries, follow-ups due."
            count={rows.length > 0 ? `${rows.length} schedule(s)` : undefined}
            loading={loading && rows.length === 0}
            loadingColumns={columns.length}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title="Nothing to chase right now." />}
            // TODO(comb-title-area): manual - move inline filters into drawer fields (filters={{ fields, values, onChange, onClear }})
            filters={<Select name="expediting-view" label="Show" value={view} options={VIEWS} onChange={(e: any) => setView(e?.target ? e.target.value : e)} />}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable data-testid="expediting-table" columns={columns} rows={rows} rowKey={(r: any) => r.schedule_id} loading={loading} />
            </div>
        </ListPageTemplate>
    );
};

export default ExpeditingPage;
