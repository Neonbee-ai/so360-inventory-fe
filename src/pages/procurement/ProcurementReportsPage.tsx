import React, { useEffect, useState } from 'react';
import { procurementInsightsService, type ProcurementReport } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Button, DataTable, EmptyState, ListPageTemplate, Tabs, TextField, getErrorMessage, toast, type DataTableColumn } from '@so360/design-system';

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

const ProcurementReportsPage = () => {
    const formatters = useInventoryFormatters();
    const [report, setReport] = useState<ProcurementReport>('purchase_register');
    const [range, setRange] = useState({ from: '', to: '' });
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { run(); }, [report]);

    const run = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await procurementInsightsService.getReport(report, {
                from: range.from || undefined,
                to: range.to || undefined,
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
        const escape = (v: any) => {
            const s = v == null ? '' : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [
            columns.map(humanise).join(','),
            ...rows.map(r => columns.map(c => escape(r[c])).join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${report}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${rows.length} row(s)`);
    };

    const columnKeys = rows.length ? Object.keys(rows[0]) : [];
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
        <ListPageTemplate
            title="Procurement Reports"
            description={active?.hint}
            count={rows.length > 0 ? `${rows.length} row(s)` : undefined}
            primaryAction={<Button onClick={run}>Run</Button>}
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
            toolbar={(
                <div className="flex flex-wrap items-end gap-nb-3">
                    <TextField
                        name="rep-from"
                        label="From"
                        type="date"
                        value={range.from}
                        onChange={e => setRange({ ...range, from: e.target.value })}
                    />
                    <TextField
                        name="rep-to"
                        label="To"
                        type="date"
                        value={range.to}
                        onChange={e => setRange({ ...range, to: e.target.value })}
                    />
                </div>
            )}
            loading={loading}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title="No rows for this report." />}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable
                    data-testid="procurement-report-table"
                    columns={columns}
                    rows={rows}
                    rowKey={(_row: any) => String(rows.indexOf(_row))}
                    loading={loading}
                />
            </div>
        </ListPageTemplate>
    );
};

export default ProcurementReportsPage;
