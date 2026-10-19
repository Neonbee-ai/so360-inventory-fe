import React, { useEffect, useState } from 'react';
import { procurementInsightsService } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Badge, DataTable, EmptyState, ListPageTemplate, Select, getErrorMessage, type DataTableColumn } from '@so360/design-system';

type SortKey = 'purchase_value' | 'delivery_performance_percent' | 'quality_score' | 'rejection_percent';

/** Colour a percentage by how good it is, so the table reads at a glance. */
const scoreClass = (value: number | null, goodAbove: number, badBelow: number) => {
    if (value == null) return 'text-fg-subtle';
    if (value >= goodAbove) return 'text-success';
    if (value < badBelow) return 'text-danger';
    return 'text-warning';
};

const SORT_OPTIONS = [
    { value: 'purchase_value', label: 'Purchase value' },
    { value: 'delivery_performance_percent', label: 'Delivery performance' },
    { value: 'quality_score', label: 'Quality score' },
    { value: 'rejection_percent', label: 'Rejection rate (lowest first)' },
];

const pct = (v: number | null | undefined) => (v != null ? `${v}%` : '—');
const days = (v: number | null | undefined) => (v != null ? `${v}d` : '—');

const VendorPerformancePage = () => {
    const formatters = useInventoryFormatters();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('purchase_value');

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await procurementInsightsService.getVendorPerformance();
            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load vendor performance'));
        } finally {
            setLoading(false);
        }
    };

    const sorted = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? -1;
        const bv = b[sortKey] ?? -1;
        // Rejection is the one axis where lower is better.
        return sortKey === 'rejection_percent' ? av - bv : bv - av;
    });

    const columns: DataTableColumn<any>[] = [
        {
            key: 'vendor', header: 'Vendor',
            render: v => (
                <div className="flex flex-col gap-nb-1">
                    <span className="font-semibold text-fg">{v.vendor_name || v.vendor_id.slice(0, 8)}</span>
                    {v.is_preferred && <Badge tone="warning" size="sm">Preferred</Badge>}
                </div>
            ),
        },
        { key: 'purchase_value', header: 'Purchase Value', align: 'right', render: v => <span className="font-semibold text-fg">{formatters.formatCurrency(v.purchase_value)}</span> },
        { key: 'order_count', header: 'Orders', align: 'center', render: v => v.order_count },
        { key: 'open_orders', header: 'Open', align: 'center', render: v => v.open_orders },
        { key: 'delivery_performance_percent', header: 'On-Time', align: 'center', render: v => <span className={`font-semibold ${scoreClass(v.delivery_performance_percent, 90, 70)}`}>{pct(v.delivery_performance_percent)}</span> },
        { key: 'average_lead_time_days', header: 'Lead Time', align: 'center', render: v => days(v.average_lead_time_days) },
        { key: 'average_response_days', header: 'Response', align: 'center', render: v => days(v.average_response_days) },
        { key: 'quality_score', header: 'Quality', align: 'center', render: v => <span className={`font-semibold ${scoreClass(v.quality_score, 95, 85)}`}>{pct(v.quality_score)}</span> },
        { key: 'rejection_percent', header: 'Rejection', align: 'center', render: v => <span className={`font-semibold ${v.rejection_percent > 5 ? 'text-danger' : 'text-fg-muted'}`}>{pct(v.rejection_percent)}</span> },
        { key: 'quote_win_rate_percent', header: 'Quote Win', align: 'center', render: v => pct(v.quote_win_rate_percent) },
        { key: 'returns_raised', header: 'Returns', align: 'center', render: v => <span className={v.returns_raised > 0 ? 'font-semibold text-danger' : 'text-fg-subtle'}>{v.returns_raised}</span> },
    ];

    return (
        <ListPageTemplate
            title="Vendor Performance"
            description="Scored from what actually happened — deliveries, rejections, quotes and spend."
            loading={loading}
            isEmpty={!loading && !error && sorted.length === 0}
            empty={<EmptyState title="No purchase history to score yet." />}
            toolbarEnd={(
                <Select
                    name="vendor_sort"
                    aria-label="Rank by"
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    options={SORT_OPTIONS}
                />
            )}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable
                    data-testid="vendor-performance-table"
                    columns={columns}
                    rows={sorted}
                    rowKey={v => v.vendor_id}
                    loading={loading}
                />
                <p className="text-nb-sm text-fg-subtle">
                    On-time is measured against the vendor's promised date where they acknowledged one, otherwise the date we asked for.
                    Quality is accepted units as a share of everything received.
                </p>
            </div>
        </ListPageTemplate>
    );
};

export default VendorPerformancePage;
