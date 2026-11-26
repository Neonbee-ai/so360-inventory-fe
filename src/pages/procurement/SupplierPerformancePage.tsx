import React, { useEffect, useState } from 'react';
import { matchService } from '../../services/matchService';
import { Alert, Badge, DataTable, EmptyState, KpiCard, ListPageTemplate, Select, getErrorMessage, type DataTableColumn } from '@so360/design-system';

const SEGMENTS = [{ value: 'vendor', label: 'By supplier' }, { value: 'category', label: 'By item category' }, { value: 'site', label: 'By warehouse / site' }];
const PERIODS = [{ value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }, { value: '365d', label: 'Last 12 months' }];

const FLAG_LABELS: Record<string, string> = {
    on_time_delivery: 'Late deliveries', accepted_in_full: 'Short acceptance', qc_reject_rate: 'Quality', ack_response_hours: 'Slow to acknowledge',
    price_variance_pct: 'Price above PO', claim_closure_days: 'Slow claims',
};

const pct = (m: any) => (m?.value != null ? `${m.value}%` : '-');
const unit = (m: any, u: string) => (m?.value != null ? `${m.value}${u}` : '-');
/** Value with the number of observations it rests on; "few" when too small to judge. */
const withN = (text: string, m: any) => (
    <span>
        {text}
        <span className="ml-nb-1 text-nb-caption text-fg-subtle">n={m?.sample_size ?? 0}{m?.provisional ? ' (few)' : ''}</span>
    </span>
);

/**
 * Supplier performance: delivery against the agreed date (buyer-caused delays excluded and counted), acceptance,
 * quality, acknowledgement speed, price variance and claim closure, by supplier, category or site.
 * Every figure shows its sample size; the formula version is stated in the header.
 */
const SupplierPerformancePage = () => {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [segment, setSegment] = useState('vendor');
    const [period, setPeriod] = useState('90d');

    useEffect(() => {
        setLoading(true);
        setError(null);
        Promise.resolve()
            .then(() => matchService.supplierPerformance({ segment, period }))
            .then(setData)
            .catch((e: any) => setError(getErrorMessage(e, 'Failed to load supplier performance')))
            .finally(() => setLoading(false));
    }, [segment, period]);

    const rows: any[] = data?.rows ?? [];
    const flagged = rows.filter((r) => (r.below_threshold || []).length > 0).length;

    const columns: DataTableColumn<any>[] = [
        { key: 'who', header: segment === 'vendor' ? 'Supplier' : segment === 'category' ? 'Supplier / category' : 'Supplier / site', alwaysVisible: true, render: (r: any) => <span>{r.vendor_name ?? r.vendor_id?.slice(0, 8)}{r.segment_key ? <span className="ml-nb-1 text-nb-caption text-fg-subtle">{String(r.segment_key).slice(0, 8)}</span> : null}</span> },
        { key: 'otd', header: 'On time', align: 'right', render: (r: any) => withN(pct(r.metrics.on_time_delivery), r.metrics.on_time_delivery) },
        { key: 'excl', header: 'Excluded (our delay)', align: 'right', render: (r: any) => r.metrics.on_time_delivery.excluded_buyer_caused },
        { key: 'full', header: 'Accepted in full', align: 'right', render: (r: any) => withN(pct(r.metrics.accepted_in_full), r.metrics.accepted_in_full) },
        { key: 'rej', header: 'Rejected', align: 'right', render: (r: any) => withN(pct(r.metrics.qc_reject_rate), r.metrics.qc_reject_rate) },
        { key: 'lead', header: 'Date accuracy', align: 'right', render: (r: any) => withN(unit(r.metrics.lead_time_days, 'd'), r.metrics.lead_time_days) },
        { key: 'ack', header: 'Acknowledges in', align: 'right', render: (r: any) => withN(unit(r.metrics.ack_response_hours, 'h'), r.metrics.ack_response_hours) },
        { key: 'price', header: 'Price vs PO', align: 'right', render: (r: any) => withN(pct(r.metrics.price_variance_pct), r.metrics.price_variance_pct) },
        { key: 'claim', header: 'Claim closure', align: 'right', render: (r: any) => withN(unit(r.metrics.claim_closure_days, 'd'), r.metrics.claim_closure_days) },
        { key: 'flags', header: 'Attention', render: (r: any) => (r.below_threshold?.length ? <span className="inline-flex flex-wrap gap-1">{r.below_threshold.map((f: string) => <Badge key={f} tone="warning">{FLAG_LABELS[f] || f}</Badge>)}</span> : <Badge tone="success">On track</Badge>) },
    ];

    return (
        <ListPageTemplate
            trail={[]}
            title="Supplier Performance"
            description={data ? `Formula ${data.formula_version} - last ${data.period_days} days. Buyer-caused delays are not held against the supplier.` : 'Delivery, quality, acknowledgement, price and claims by supplier.'}
            loading={loading && !data}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title="No supplier activity in this period." />}
            kpis={data ? (
                <div className="grid grid-cols-1 gap-nb-4 wc-medium:grid-cols-3">
                    <KpiCard label="Suppliers scored" value={new Set(rows.map((r) => r.vendor_id)).size} />
                    <KpiCard label="Need attention" value={flagged} />
                    <KpiCard label="Receipt lines measured" value={rows.reduce((s, r) => s + (r.sample_size || 0), 0)} />
                </div>
            ) : undefined}
            filters={(
                <div className="flex flex-wrap gap-nb-3">
                    <Select name="perf-segment" label="Group" value={segment} options={SEGMENTS} onChange={(e: any) => setSegment(e?.target ? e.target.value : e)} />
                    <Select name="perf-period" label="Period" value={period} options={PERIODS} onChange={(e: any) => setPeriod(e?.target ? e.target.value : e)} />
                </div>
            )}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable data-testid="supplier-performance-table" columns={columns} rows={rows} rowKey={(r: any) => `${r.vendor_id}|${r.segment_key ?? ''}`} loading={loading} />
            </div>
        </ListPageTemplate>
    );
};

export default SupplierPerformancePage;
