import React, { useEffect, useState } from 'react';
import { procurementInsightsService } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { getErrorMessage } from '@so360/design-system';

type SortKey = 'purchase_value' | 'delivery_performance_percent' | 'quality_score' | 'rejection_percent';

/** Colour a percentage by how good it is, so the table reads at a glance. */
const scoreClass = (value: number | null, goodAbove: number, badBelow: number) => {
    if (value == null) return 'text-fg-subtle';
    if (value >= goodAbove) return 'text-success';
    if (value < badBelow) return 'text-rose-400';
    return 'text-warning';
};

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

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Vendor Performance
                </h1>
                <p className="text-fg-muted mt-2 font-medium">
                    Scored from what actually happened — deliveries, rejections, quotes and spend.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>
            )}

            <div className="flex items-center gap-3">
                <label htmlFor="vendor-sort" className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Rank by</label>
                <select
                    id="vendor-sort"
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    className="bg-bg border border-line rounded-xl px-4 py-2 text-sm text-fg"
                >
                    <option value="purchase_value">Purchase value</option>
                    <option value="delivery_performance_percent">Delivery performance</option>
                    <option value="quality_score">Quality score</option>
                    <option value="rejection_percent">Rejection rate (lowest first)</option>
                </select>
            </div>

            <div className="bg-surface/50 border border-line rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-line bg-surface-raised/30 text-left text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                                <th className="px-4 py-3">Vendor</th>
                                <th className="px-4 py-3 text-right">Purchase Value</th>
                                <th className="px-4 py-3 text-center">Orders</th>
                                <th className="px-4 py-3 text-center">Open</th>
                                <th className="px-4 py-3 text-center">On-Time</th>
                                <th className="px-4 py-3 text-center">Lead Time</th>
                                <th className="px-4 py-3 text-center">Response</th>
                                <th className="px-4 py-3 text-center">Quality</th>
                                <th className="px-4 py-3 text-center">Rejection</th>
                                <th className="px-4 py-3 text-center">Quote Win</th>
                                <th className="px-4 py-3 text-center">Returns</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line/50">
                            {loading ? (
                                <tr><td colSpan={11} className="px-4 py-12 text-center text-fg-subtle animate-pulse">Scoring vendors...</td></tr>
                            ) : sorted.length === 0 ? (
                                <tr><td colSpan={11} className="px-4 py-12 text-center text-fg-subtle">No purchase history to score yet.</td></tr>
                            ) : sorted.map(v => (
                                <tr key={v.vendor_id} className="hover:bg-surface-raised/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-fg">{v.vendor_name || v.vendor_id.slice(0, 8)}</div>
                                        {v.is_preferred && (
                                            <span className="text-[9px] font-bold uppercase tracking-wide text-warning">Preferred</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-fg">{formatters.formatCurrency(v.purchase_value)}</td>
                                    <td className="px-4 py-3 text-center text-fg-muted">{v.order_count}</td>
                                    <td className="px-4 py-3 text-center text-fg-muted">{v.open_orders}</td>
                                    <td className={`px-4 py-3 text-center font-bold ${scoreClass(v.delivery_performance_percent, 90, 70)}`}>
                                        {v.delivery_performance_percent != null ? `${v.delivery_performance_percent}%` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-fg-muted">
                                        {v.average_lead_time_days != null ? `${v.average_lead_time_days}d` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-fg-muted">
                                        {v.average_response_days != null ? `${v.average_response_days}d` : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-center font-bold ${scoreClass(v.quality_score, 95, 85)}`}>
                                        {v.quality_score != null ? `${v.quality_score}%` : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-center font-bold ${v.rejection_percent > 5 ? 'text-rose-400' : 'text-fg-muted'}`}>
                                        {v.rejection_percent != null ? `${v.rejection_percent}%` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-fg-muted">
                                        {v.quote_win_rate_percent != null ? `${v.quote_win_rate_percent}%` : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-center ${v.returns_raised > 0 ? 'text-rose-400 font-bold' : 'text-fg-subtle'}`}>
                                        {v.returns_raised}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-xs text-fg-subtle">
                On-time is measured against the vendor's promised date where they acknowledged one, otherwise the date we asked for.
                Quality is accepted units as a share of everything received.
            </p>
        </div>
    );
};

export default VendorPerformancePage;
