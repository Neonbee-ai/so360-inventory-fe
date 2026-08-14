import React, { useEffect, useState } from 'react';
import { procurementInsightsService, type ProcurementReport } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { getErrorMessage, toast } from '@so360/design-system';

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

    const columns = rows.length ? Object.keys(rows[0]) : [];
    const active = REPORTS.find(r => r.key === report);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                    Procurement Reports
                </h1>
                <p className="text-slate-400 mt-2 font-medium">{active?.hint}</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {REPORTS.map(r => (
                    <button
                        key={r.key}
                        onClick={() => setReport(r.key)}
                        aria-pressed={report === r.key}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${report === r.key
                            ? 'bg-indigo-600/10 text-indigo-300 border-indigo-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'}`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                    <label htmlFor="rep-from" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">From</label>
                    <input
                        id="rep-from"
                        type="date"
                        value={range.from}
                        onChange={e => setRange({ ...range, from: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="rep-to" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To</label>
                    <input
                        id="rep-to"
                        type="date"
                        value={range.to}
                        onChange={e => setRange({ ...range, to: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200"
                    />
                </div>
                <button onClick={run} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors">
                    Run
                </button>
                <button onClick={exportCsv} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-colors">
                    Export CSV
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>
            )}

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/30">
                                {columns.map(c => (
                                    <th key={c} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                                        {humanise(c)}
                                    </th>
                                ))}
                                {columns.length === 0 && (
                                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Result</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr><td colSpan={Math.max(1, columns.length)} className="px-4 py-12 text-center text-slate-500 animate-pulse">Running report...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={Math.max(1, columns.length)} className="px-4 py-12 text-center text-slate-500">No rows for this report.</td></tr>
                            ) : rows.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                    {columns.map(c => (
                                        <td key={c} className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                            {typeof row[c] === 'number' && CURRENCY_KEYS.has(c)
                                                ? formatters.formatCurrency(row[c])
                                                : typeof row[c] === 'boolean'
                                                    ? (row[c] ? 'Yes' : 'No')
                                                    : row[c] == null || row[c] === ''
                                                        ? '—'
                                                        : String(row[c])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {rows.length > 0 && (
                <p className="text-xs text-slate-500">{rows.length} row(s)</p>
            )}
        </div>
    );
};

export default ProcurementReportsPage;
