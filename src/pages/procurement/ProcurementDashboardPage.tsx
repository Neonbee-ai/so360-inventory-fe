import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementInsightsService } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { getErrorMessage } from '@so360/design-system';

const ALERT_STYLES: Record<string, string> = {
    critical: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
};

/** Where each alert type takes the buyer when they act on it. */
const ALERT_ROUTES: Record<string, string> = {
    pr_awaiting_approval: '/procurement/pr',
    delivery_overdue: '/procurement/po',
    po_unacknowledged: '/procurement/po',
    qc_pending: '/procurement/quality',
    payment_overdue: '/procurement/po',
    returns_open: '/procurement/returns',
};

/**
 * Procurement command centre.
 *
 * Ordered the way a buyer's day runs: what needs a decision now (alerts and
 * the pipeline), then what it is costing (value and savings), then where the
 * money goes (vendor and category cuts).
 */
const ProcurementDashboardPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>(null);
    const [trends, setTrends] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [dashboard, trend] = await Promise.all([
                procurementInsightsService.getDashboard(),
                procurementInsightsService.getTrends(6).catch(() => null),
            ]);
            setData(dashboard);
            setTrends(trend);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load the procurement dashboard'));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
                    <span>⚠</span> {error}
                </div>
            </div>
        );
    }

    const k = data?.kpis || {};

    const pipeline = [
        { label: 'Pending PR', value: k.pending_requisitions ?? 0, route: '/procurement/pr' },
        { label: 'Awaiting Approval', value: k.pending_approval ?? 0, route: '/procurement/pr' },
        { label: 'RFQs Waiting', value: k.rfqs_awaiting_response ?? 0, route: '/procurement/rfq' },
        { label: 'PO Issued', value: k.po_issued ?? 0, route: '/procurement/po' },
        { label: 'PO Pending Delivery', value: k.po_pending_delivery ?? 0, route: '/procurement/po' },
        { label: 'GRNs Pending', value: k.grns_pending_inspection ?? 0, route: '/procurement/grn' },
        { label: 'Inspection Pending', value: k.quality_inspection_pending ?? 0, route: '/procurement/quality' },
        { label: 'Invoices Pending', value: k.purchase_invoices_pending ?? 0, route: '/procurement/po' },
        { label: 'Payments Pending', value: k.vendor_payments_pending ?? 0, route: '/procurement/po' },
        { label: 'Open Returns', value: k.open_returns ?? 0, route: '/procurement/returns' },
    ];

    const health = [
        {
            label: 'Procurement Lead Time',
            value: k.procurement_lead_time_days != null ? `${k.procurement_lead_time_days} days` : '—',
            hint: 'Order raised to first receipt',
        },
        {
            label: 'Approval Cycle',
            value: k.average_approval_days != null ? `${k.average_approval_days} days` : '—',
            hint: 'Requisition submitted to approved',
        },
        {
            label: 'Delayed Deliveries',
            value: k.delayed_deliveries ?? 0,
            hint: 'Past the promised date',
            danger: (k.delayed_deliveries ?? 0) > 0,
        },
        {
            label: 'Rejected Deliveries',
            value: k.rejected_deliveries ?? 0,
            hint: 'Receipts with rejected or damaged units',
            danger: (k.rejected_deliveries ?? 0) > 0,
        },
    ];

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Procurement Dashboard
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        The whole purchasing pipeline — requisition to payment — in one place.
                    </p>
                </div>
                <button
                    onClick={load}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Alerts first — they are the things a human must act on today. */}
            {(data?.alerts || []).length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Needs Attention</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.alerts.map((alert: any) => (
                            <button
                                key={alert.type}
                                onClick={() => navigate(ALERT_ROUTES[alert.type] || '/procurement/pr')}
                                className={`text-left p-4 rounded-2xl border transition-all hover:scale-[1.01] ${ALERT_STYLES[alert.severity] || ALERT_STYLES.info}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium">{alert.message}</span>
                                    <span className="text-xl font-black">{alert.count}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
                    <span className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Total Procurement Value</span>
                    <div className="text-4xl font-black mt-2">{formatters.formatCurrency(k.total_procurement_value || 0)}</div>
                    <p className="mt-2 text-sm text-blue-200">{k.po_issued || 0} orders issued · {k.completed_orders || 0} completed</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cost Savings</span>
                    <div className="text-3xl font-bold text-emerald-400 mt-2">{formatters.formatCurrency(k.cost_savings || 0)}</div>
                    <p className="mt-2 text-xs text-slate-500">Won against higher competing quotes</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Budget Utilisation</span>
                    <div className="text-3xl font-bold text-slate-100 mt-2">
                        {k.budget_utilisation_percent != null ? `${k.budget_utilisation_percent}%` : '—'}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        {k.budget_allocated ? `of ${formatters.formatCurrency(k.budget_allocated)} allocated` : 'No budgets set on requisitions'}
                    </p>
                </div>
            </div>

            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Pipeline</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {pipeline.map(tile => (
                        <button
                            key={tile.label}
                            onClick={() => navigate(tile.route)}
                            className="text-left bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-colors"
                        >
                            <div className="text-2xl font-bold text-slate-100">{tile.value}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{tile.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Process Health</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {health.map(tile => (
                        <div key={tile.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                            <div className={`text-2xl font-bold ${tile.danger ? 'text-rose-400' : 'text-slate-100'}`}>{tile.value}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{tile.label}</div>
                            <div className="text-[10px] text-slate-600 mt-1">{tile.hint}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-sm font-bold text-slate-300 mb-4">Spend by Vendor</h2>
                    {(data?.spend_by_vendor || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No purchase orders yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {data.spend_by_vendor.map((row: any) => {
                                const top = data.spend_by_vendor[0]?.amount || 1;
                                return (
                                    <div key={row.vendor_id}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-300 truncate max-w-[60%]">{row.vendor_name || row.vendor_id.slice(0, 8)}</span>
                                            <span className="text-slate-100 font-bold">{formatters.formatCurrency(row.amount)}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${Math.max(2, (row.amount / top) * 100)}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-sm font-bold text-slate-300 mb-4">Monthly Spend</h2>
                    {!(trends?.monthly_spend || []).length ? (
                        <p className="text-sm text-slate-500">Not enough history yet.</p>
                    ) : (
                        <div className="flex items-end gap-2 h-40">
                            {trends.monthly_spend.map((m: any) => {
                                const max = Math.max(...trends.monthly_spend.map((x: any) => x.value)) || 1;
                                return (
                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className="w-full bg-gradient-to-t from-blue-600 to-cyan-500 rounded-t"
                                            style={{ height: `${Math.max(4, (m.value / max) * 120)}px` }}
                                            title={`${m.month}: ${formatters.formatCurrency(m.value)}`}
                                        />
                                        <span className="text-[9px] text-slate-500">{m.month.slice(5)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {(trends?.top_items || []).length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-sm font-bold text-slate-300 mb-4">Top Purchased Items</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                <th className="pb-2">Item</th>
                                <th className="pb-2 text-center">Quantity</th>
                                <th className="pb-2 text-right">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trends.top_items.map((item: any) => (
                                <tr key={item.item_id} className="border-b border-slate-800/50">
                                    <td className="py-2 text-slate-200">
                                        {item.item_name || item.item_id.slice(0, 8)}
                                        {item.sku && <span className="block text-[10px] text-slate-500 font-mono">{item.sku}</span>}
                                    </td>
                                    <td className="py-2 text-center text-slate-300">{item.quantity}</td>
                                    <td className="py-2 text-right text-slate-100 font-bold">{formatters.formatCurrency(item.value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={() => navigate('/procurement/reports')}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
                >
                    Open Reports
                </button>
                <button
                    onClick={() => navigate('/procurement/vendor-performance')}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
                >
                    Vendor Performance
                </button>
            </div>
        </div>
    );
};

export default ProcurementDashboardPage;
