import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { toast, getErrorMessage } from '@so360/design-system';

/**
 * Sales demand — the buy list a confirmed customer order creates.
 *
 * Every ordered line is netted against free stock and quantity already on
 * order, so the only number shown is what is genuinely short. Raising the
 * requisition from here means the customer order is never re-keyed by hand.
 */
const SalesDemandPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onlyShort, setOnlyShort] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [raising, setRaising] = useState<string | null>(null);

    useEffect(() => { load(); }, [onlyShort]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await procurementService.getSalesDemand({ only_short: onlyShort }));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load sales demand'));
        } finally {
            setLoading(false);
        }
    };

    const raise = async (order: any) => {
        if (!window.confirm(`Raise a requisition for ${order.short_line_count} short line(s) on ${order.so_number}?`)) return;
        setRaising(order.sales_order_id);
        try {
            const res = await procurementService.raiseRequisitionForSalesOrder(order.sales_order_id);
            toast.success(`Requisition ${res?.requisition?.pr_number || ''} raised for ${order.so_number}`);
            navigate(`/procurement/pr/${res.requisition.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to raise the requisition'));
            setRaising(null);
        }
    };

    const summary = data?.summary || {};
    const orders = data?.orders || [];

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Sales Demand
                </h1>
                <p className="text-slate-400 mt-2 font-medium">
                    Confirmed customer orders, netted against stock and open purchase orders.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Orders Shown', value: summary.order_count ?? 0 },
                    { label: 'Need Purchasing', value: summary.orders_needing_purchase ?? 0 },
                    { label: 'Short Lines', value: summary.short_line_count ?? 0 },
                    { label: 'Shortfall Value', value: formatters.formatCurrency(summary.shortfall_value || 0) },
                ].map((s, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                        <div className="mt-3 text-2xl font-bold text-slate-100">{s.value}</div>
                    </div>
                ))}
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <input
                    type="checkbox"
                    checked={onlyShort}
                    aria-label="Only orders needing purchase"
                    onChange={e => setOnlyShort(e.target.checked)}
                />
                Only orders needing purchase
            </label>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Sales Order</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Customer</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Delivery</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Short Lines</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Shortfall</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 animate-pulse">Netting demand against stock...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                {onlyShort ? 'Every confirmed order is covered by stock or existing purchase orders.' : 'No confirmed sales orders.'}
                            </td></tr>
                        ) : orders.map((o: any) => (
                            <React.Fragment key={o.sales_order_id}>
                                <tr className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => setExpanded(expanded === o.sales_order_id ? null : o.sales_order_id)}
                                            className="font-semibold text-slate-200 hover:text-blue-400 transition-colors"
                                        >
                                            {o.so_number}
                                        </button>
                                        <div className="text-xs text-slate-500">{o.status}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-300">{o.customer_name || '—'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-300">
                                        {o.requested_delivery_date ? formatters.formatDate(o.requested_delivery_date) : '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={o.short_line_count > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                            {o.short_line_count > 0 ? `${o.short_line_count} short` : 'Covered'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-100">
                                        {formatters.formatCurrency(o.shortfall_value || 0)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {o.short_line_count > 0 ? (
                                            <button
                                                onClick={() => raise(o)}
                                                disabled={raising === o.sales_order_id}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors"
                                            >
                                                {raising === o.sales_order_id ? 'Raising...' : 'Raise Requisition'}
                                            </button>
                                        ) : (
                                            <span className="text-slate-600 text-sm">—</span>
                                        )}
                                    </td>
                                </tr>
                                {expanded === o.sales_order_id && (
                                    <tr className="bg-slate-950/50">
                                        <td colSpan={6} className="px-6 py-4">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        <th className="pb-2">Item</th>
                                                        <th className="pb-2 text-center">Ordered</th>
                                                        <th className="pb-2 text-center">From Stock</th>
                                                        <th className="pb-2 text-center">On Order</th>
                                                        <th className="pb-2 text-center">Short</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {o.lines.map((l: any) => (
                                                        <tr key={l.sales_order_line_id} className="border-t border-slate-800/50">
                                                            <td className="py-2 text-slate-300">
                                                                {l.item_name || l.sku || 'Line'}
                                                                {l.sku && <span className="block text-[10px] text-slate-600 font-mono">{l.sku}</span>}
                                                            </td>
                                                            <td className="py-2 text-center text-slate-300">{l.ordered_quantity}</td>
                                                            <td className="py-2 text-center text-emerald-400">{l.covered_by_stock}</td>
                                                            <td className="py-2 text-center text-blue-400">{l.covered_by_open_orders}</td>
                                                            <td className={`py-2 text-center font-bold ${l.shortfall > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                                                                {l.shortfall}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-500">
                Stock is a shared pool — it is allocated to orders in date sequence, so the same units are never
                promised to two customers.
            </p>
        </div>
    );
};

export default SalesDemandPage;
