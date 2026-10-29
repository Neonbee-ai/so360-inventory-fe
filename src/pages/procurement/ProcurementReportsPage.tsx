import React, { useEffect, useState } from 'react';
import { procurementInsightsService, type ProcurementReport } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { buildCsv, downloadCsv } from '../../utils/csvDownload';
import { Alert, Button, DataTable, EmptyState, ListPageTemplate, SearchInput, Tabs, getErrorMessage, toast, type DataTableColumn, type FilterValues } from '@so360/design-system';

const REPORTS: Array<{ key: ProcurementReport; label: string; hint: string }> = [
    { key: 'purchase_register', label: 'Purchase Register', hint: 'Every purchase order with its value' },
    { key: 'open_purchase_orders', label: 'Open Purchase Orders', hint: 'Ordered but not fully received' },
    { key: 'pending_grns', label: 'Pending GRNs', hint: 'Deliveries still outstanding' },
    { key: 'delayed_deliveries', label: 'Delayed Deliveries', hint: 'Past the promised date' },
    { key: 'pending_approvals', label: 'Pending Approvals', hint: 'Requisitions waiting on a decision' },
    { key: 'procurement_aging', label: 'Procurement Aging', hint: 'How long requisitions have been open' },
    { key: 'rejected_materials', label: 'Rejected Materials', hint: 'What was rejected, why, and its value' },
    { key: 'vendor_spend', label: 'Vendor Spend', hint: 'Spend and order count per vendor' },
    { key: 'project_procurement', label: 'Project Procurement', hint: 'Spend attributed to projects' },
    { key: 'manufacturing_procurement', label: 'Manufacturing Procurement', hint: 'Requisitions raised by production' },
    { key: 'savings', label: 'Savings Report', hint: 'Won against higher competing quotes' },
    { key: 'lead_time_analysis', label: 'Lead Time Analysis', hint: 'Order to first receipt, per order' },
    { key: 'budget_vs_actual', label: 'Budget vs Actual', hint: 'Requisition budget against what was ordered' },
    { key: 'purchase_cost_analysis', label: 'Purchase Cost Analysis', hint: 'Price spread per item' },
];

const CURRENCY_KEYS = new Set([
    'total', 'value', 'subtotal', 'tax', 'estimated_total', 'budget', 'estimated',
    'actual', 'variance', 'saving', 'highest_quote', 'awarded_value', 'value_rejected',
    'min_price', 'max_price', 'average_price', 'price_variance',
]);

/** Turn a snake_case field into a readable column header. */
const humanise = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Case-insensitive match of the search text against every cell of a row. */
export const filterReportRows = (rows: any[], term: string) => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row => Object.values(row ?? {}).some(v => v != null && String(v).toLowerCase().includes(q)));
};

const ProcurementReportsPage = () => {
    const formatters = useInventoryFormatters();
    const [report, setReport] = useState<ProcurementReport>('purchase_register');
    const [range, setRange] = useState({ from: '', to: '' });
    const [rows, setRows] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { run(); }, [report]);

    const run = async (override?: { from: string; to: string }) => {
        const r = override ?? range;
        setLoading(true);
        setError(null);
        try {
            const res = await procurementInsightsService.getReport(report, {
                from: r.from || undefined,
                to: r.to || undefined,
            });
            setRows(Array.isArray(res?.rows) ? res.rows : []);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to run the report'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    /** Export exactly what is on screen, so the CSV always matches the view. */
    const exportCsv = () => {
        if (!rows.length) {
            toast.warning('Nothing to export — run a report that returns rows first.');
            return;
        }
        const columns = Object.keys(rows[0]);
        const csv = buildCsv(columns.map(humanise), rows.map(r => columns.map(c => r[c])));
        downloadCsv(`${report}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
        toast.success(`Exported ${rows.length} row(s)`);
    };

    const visibleRows = filterReportRows(rows, searchTerm);
    const columnKeys = rows.length ? Object.keys(rows[0]) : [];

    const filterValues: FilterValues = {
        period: range.from || range.to ? { start: range.from, end: range.to } : null,
        report,
    };
    const handleFilterChange = (v: FilterValues) => {
        const p = (v.period ?? {}) as { start?: string; end?: string };
        const next = { from: p.start ?? '', to: p.end ?? '' };
        const rangeChanged = next.from !== range.from || next.to !== range.to;
        setRange(next);
        if (typeof v.report === 'string' && v.report && v.report !== report) setReport(v.report as ProcurementReport);
        else if (rangeChanged && (!next.from || !next.to || next.from <= next.to)) run(next);
    };
    const active = REPORTS.find(r => r.key === report);

    const columns: DataTableColumn<any>[] = columnKeys.map(c => ({
        key: c,
        header: humanise(c),
        render: (row: any) =>
            typeof row[c] === 'number' && CURRENCY_KEYS.has(c)
                ? formatters.formatCurrency(row[c])
                : typeof row[c] === 'boolean'
                    ? (row[c] ? 'Yes' : 'No')
                    : row[c] == null || row[c] === ''
                        ? '—'
                        : String(row[c]),
    }));

    return (
        <ListPageTemplate trail={[]}
            title="Procurement Reports"
            description={active?.hint}
            count={visibleRows.length > 0 ? `${visibleRows.length} row(s)` : undefined}
            primaryAction={<Button onClick={() => run()}>Run</Button>}
            headerSecondaryActions={[<Button key="export" variant="secondary" onClick={exportCsv}>Export CSV</Button>]}
            views={(
                <Tabs
                    name="report"
                    variant="pill"
                    maxVisible={5}
                    items={REPORTS.map(r => ({ id: r.key, label: r.label }))}
                    value={report}
                    onChange={id => setReport(id as ProcurementReport)}
                />
            )}
            search={<SearchInput placeholder="Search this report..." value={searchTerm} onChange={setSearchTerm} />}
            filterConfig={{
                fields: [
                    { key: 'period', label: 'Period', type: 'daterange' },
                    { key: 'report', label: 'Report', type: 'select', options: REPORTS.map(r => ({ value: r.key, label: r.label })) },
                ],
                values: filterValues,
                onChange: handleFilterChange,
                onClear: () => { setSearchTerm(''); setRange({ from: '', to: '' }); run({ from: '', to: '' }); },
            }}
            loading={loading && rows.length === 0}
            isEmpty={!loading && !error && visibleRows.length === 0}
            empty={<EmptyState title="No rows for this report." />}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable
                    data-testid="procurement-report-table"
                    columns={columns}
                    rows={visibleRows}
                    rowKey={(_row: any) => String(visibleRows.indexOf(_row))}
                    loading={loading && rows.length === 0}
                />
            </div>
        </ListPageTemplate>
    );
};

export default ProcurementReportsPage;
