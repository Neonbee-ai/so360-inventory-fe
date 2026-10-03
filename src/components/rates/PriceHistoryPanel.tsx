import React, { useEffect, useMemo, useState } from 'react';
import { inventoryService, type RateBoardHistoryPoint } from '../../services/inventoryService';
import { changePct, toIsoDate } from '../../hooks/rateBoard';

const fmt = (v: number | null | undefined): string =>
    v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const daysAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
};

const RANGES = [30, 90, 365] as const;

interface Props {
    /** Item whose daily-rate history is shown. */
    itemId: string;
    /** Variant of the item, when the history of one variant was asked for. */
    variantId?: string | null;
}

/**
 * "Price history" tab of the Item detail page: the daily-rate entries of the
 * item (or one of its variants), newest first, with the change from the
 * entry before.
 */
const PriceHistoryPanel: React.FC<Props> = ({ itemId, variantId = null }) => {
    const [days, setDays] = useState<number>(90);
    const target = variantId ?? itemId;
    const [points, setPoints] = useState<RateBoardHistoryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        setLoading(true);
        setError(null);
        inventoryService.getRateHistory(target, daysAgo(days), toIsoDate(new Date()))
            .then((res) => { if (live) setPoints(Array.isArray(res) ? res : []); })
            .catch((e: any) => { if (live) { setError(e?.message || 'Failed to load price history'); setPoints([]); } })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [target, days]);

    const rows = useMemo(() => {
        const asc = [...points].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
        return asc.map((p, i) => ({ ...p, pct: i > 0 ? changePct(Number(asc[i - 1].price), Number(p.price)) : null })).reverse();
    }, [points]);

    return (
        <section aria-label="Price history">
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Range" className="inline-flex rounded-lg border border-slate-700 p-0.5">
                    {RANGES.map((n) => (
                        <button key={n} onClick={() => setDays(n)} aria-pressed={days === n}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${days === n ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'}`}>
                            {n === 365 ? '1 year' : `${n} days`}
                        </button>
                    ))}
                </div>
            </div>
            {error && <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
            {loading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
            ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No daily rates in this period</p>
            ) : (
                <table className="w-full text-sm">
                    <thead className="text-slate-500 text-[10px] uppercase tracking-widest">
                        <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-right">Change</th>
                            <th className="px-3 py-2 text-left">Set by</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {rows.map((r) => (
                            <tr key={r.effective_date} data-testid={`price-history-${r.effective_date}`}>
                                <td className="px-3 py-2 text-slate-300">{r.effective_date}</td>
                                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">{fmt(r.price)}</td>
                                <td className={`px-3 py-2 text-right tabular-nums ${r.pct == null || r.pct === 0 ? 'text-slate-500' : r.pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {r.pct == null ? '—' : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(2)}%`}
                                </td>
                                <td className="px-3 py-2 text-slate-400">{r.set_by || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
};

export default PriceHistoryPanel;
