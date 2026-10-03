import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { inventoryService, type LossGroupBy, type LossReason, type LossSummary } from '../services/inventoryService';
import { MORTALITY_TRACKING_FLAG, fmtMoney, fmtQty, hideMortality, isFlagOn, isoDate, shiftDays } from '../hooks/lossYield';

const GROUPS: { key: LossGroupBy; label: string }[] = [
    { key: 'reason', label: 'Reason' },
    { key: 'item', label: 'Item' },
    { key: 'category', label: 'Category' },
];

/** Inline SVG line chart (no chart library is bundled with this MFE). */
const TrendChart: React.FC<{ points: { date: string; value: number }[] }> = ({ points }) => {
    if (points.length === 0) return <p className="py-6 text-center text-sm text-slate-500">No trend data</p>;
    const W = 600;
    const H = 160;
    const pad = 8;
    const max = Math.max(...points.map((p) => Number(p.value) || 0), 0) || 1;
    const step = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
    const xy = points.map((p, i) => {
        const x = points.length > 1 ? pad + i * step : W / 2;
        const y = H - pad - ((Number(p.value) || 0) / max) * (H - pad * 2);
        return [x, y] as const;
    });
    const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H - pad} L${xy[0][0].toFixed(1)},${H - pad} Z`;
    return (
        <figure>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label="Loss value trend" preserveAspectRatio="none">
                <path d={area} className="fill-rose-500/10" />
                <path d={line} className="stroke-rose-400" fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                {xy.map(([x, y], i) => (
                    <circle key={points[i].date} cx={x} cy={y} r={3} className="fill-rose-400" data-testid="trend-point">
                        <title>{`${points[i].date}: ${fmtMoney(points[i].value)}`}</title>
                    </circle>
                ))}
            </svg>
            <figcaption className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{points[0].date}</span>
                <span>{points[points.length - 1].date}</span>
            </figcaption>
        </figure>
    );
};

const LossRowBody: React.FC<{ label: string; qty: number; value: number; maxValue: number }> = ({ label, qty, value, maxValue }) => (
    <>
        <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-200 truncate">{label}</span>
            <span className="text-slate-400 tabular-nums whitespace-nowrap">
                {fmtQty(qty)} · <span className="text-rose-300">{fmtMoney(value)}</span>
            </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-800">
            <div className="h-1.5 rounded-full bg-rose-500/70" style={{ width: `${Math.max(2, ((Number(value) || 0) / maxValue) * 100)}%` }} />
        </div>
    </>
);

/** Range of the report when a row was tapped. */
export interface LossRange { from: string; to: string }

interface Props {
    /** Rendered as a tab inside another page: no page padding, h2 title. */
    embedded?: boolean;
    /** When set, each breakdown row becomes a button that calls this. */
    onRowSelect?: (groupBy: LossGroupBy, row: { key: string; label: string }, range: LossRange) => void;
}

/** Loss report: totals, breakdown by reason/item/category and a value trend. */
const LossReportPage: React.FC<Props> = ({ embedded = false, onRowSelect }) => {
    const shell = useShellBridge();
    const mortality = isFlagOn(shell, MORTALITY_TRACKING_FLAG);
    const [reasons, setReasons] = useState<LossReason[]>([]);
    const [to, setTo] = useState(() => isoDate(new Date()));
    const [from, setFrom] = useState(() => shiftDays(isoDate(new Date()), -29));
    const [groupBy, setGroupBy] = useState<LossGroupBy>('reason');
    const [data, setData] = useState<LossSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await inventoryService.getLossSummary({ from, to, group_by: groupBy }));
        } catch (e: any) {
            setError(e?.message || 'Failed to load loss report');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [from, to, groupBy]);

    useEffect(() => { void load(); }, [load]);

    // Reason codes are needed to recognise mortality rows when grouped by reason.
    useEffect(() => {
        if (mortality) return;
        inventoryService.getLossReasons().then(setReasons).catch(() => setReasons([]));
    }, [mortality]);

    const view = useMemo(
        () => (data && !mortality ? hideMortality(data, groupBy, reasons) : data),
        [data, mortality, groupBy, reasons],
    );

    const rows = [...(view?.rows ?? [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const top = rows[0];
    const maxValue = Math.max(...rows.map((r) => Number(r.value) || 0), 0) || 1;

    return (
        <div className={embedded ? '' : 'p-4 sm:p-8'}>
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    {embedded
                        ? <h2 className="text-lg font-semibold text-slate-100">Losses</h2>
                        : <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">Loss Report</h1>}
                    <p className="text-slate-400 mt-1">Where stock is lost, and how much it costs</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-slate-400">
                        From
                        <input type="date" aria-label="From" value={from} max={to}
                            onChange={(e) => e.target.value && setFrom(e.target.value)}
                            className="mt-1 block bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                    </label>
                    <label className="text-xs text-slate-400">
                        To
                        <input type="date" aria-label="To" value={to} min={from}
                            onChange={(e) => e.target.value && setTo(e.target.value)}
                            className="mt-1 block bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                    </label>
                </div>
            </header>

            {error && <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Loss value</div>
                    <div className="mt-1 text-2xl font-bold text-rose-300 tabular-nums" data-testid="total-value">{loading ? '…' : fmtMoney(view?.total_value ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Loss quantity</div>
                    <div className="mt-1 text-2xl font-bold text-slate-100 tabular-nums" data-testid="total-qty">{loading ? '…' : fmtQty(view?.total_qty ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Biggest {GROUPS.find((g) => g.key === groupBy)!.label.toLowerCase()}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-100 truncate" data-testid="top-row">{loading ? '…' : top ? top.label : '—'}</div>
                </div>
            </div>

            <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-300">Loss value trend</h2>
                {!loading && <TrendChart points={data?.trend ?? []} />}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-300">Breakdown</h2>
                    <div role="group" aria-label="Group by" className="inline-flex rounded-lg border border-slate-700 p-0.5">
                        {GROUPS.map((g) => (
                            <button
                                key={g.key}
                                onClick={() => setGroupBy(g.key)}
                                aria-pressed={groupBy === g.key}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${groupBy === g.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'}`}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                </div>
                {loading ? (
                    <p className="py-6 text-center text-slate-500">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="py-6 text-center text-slate-500">No losses in this period</p>
                ) : (
                    <ul className="space-y-2">
                        {rows.map((r) => (
                            <li key={r.key} data-testid={`loss-row-${r.key}`}>
                                {onRowSelect ? (
                                    <button
                                        type="button"
                                        onClick={() => onRowSelect(groupBy, { key: r.key, label: r.label }, { from, to })}
                                        aria-label={`Show movements for ${r.label}`}
                                        className="block w-full rounded-lg px-1 py-1 text-left hover:bg-slate-800/60"
                                    >
                                        <LossRowBody label={r.label} qty={r.qty} value={r.value} maxValue={maxValue} />
                                    </button>
                                ) : (
                                    <LossRowBody label={r.label} qty={r.qty} value={r.value} maxValue={maxValue} />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default LossReportPage;
