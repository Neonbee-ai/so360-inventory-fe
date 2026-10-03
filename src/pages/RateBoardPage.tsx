import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, History, Save, X } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import {
    inventoryService,
    type RateBoardEntry,
    type RateBoardHistoryPoint,
} from '../services/inventoryService';
import { changePct, changedEntries, rowKey, toIsoDate } from '../hooks/rateBoard';

const addDays = (iso: string, days: number): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return toIsoDate(new Date(y, m - 1, d + days));
};

const fmt = (v: number | null | undefined): string =>
    v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const pctClass = (p: number | null): string =>
    p == null || p === 0 ? 'text-slate-400' : p > 0 ? 'text-emerald-400' : 'text-rose-400';

const RateBoardPage: React.FC = () => {
    const navigate = useNavigate();
    const shell = useShellBridge();
    const canEdit = (shell as any)?.hasPermission ? (shell as any).hasPermission('items.update') !== false : true;

    const [date, setDate] = useState<string>(() => toIsoDate(new Date()));
    const [entries, setEntries] = useState<RateBoardEntry[]>([]);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [historyFor, setHistoryFor] = useState<RateBoardEntry | null>(null);
    const [history, setHistory] = useState<RateBoardHistoryPoint[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const load = useCallback(async (d: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await inventoryService.getRateBoard(d);
            setEntries(res?.entries ?? []);
            setDrafts({});
        } catch (e: any) {
            setError(e?.message || 'Failed to load rate board');
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(date); }, [date, load]);

    useEffect(() => {
        if (!historyFor) return;
        let cancelled = false;
        setHistoryLoading(true);
        inventoryService
            .getRateHistory(historyFor.variant_id || historyFor.item_id, addDays(date, -90), date)
            .then((rows) => { if (!cancelled) setHistory(Array.isArray(rows) ? rows : []); })
            .catch(() => { if (!cancelled) setHistory([]); })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });
        return () => { cancelled = true; };
    }, [historyFor, date]);

    const pending = useMemo(() => changedEntries(entries, drafts), [entries, drafts]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((e) =>
            e.item_name?.toLowerCase().includes(q) || (e.sku ?? '').toLowerCase().includes(q));
    }, [entries, search]);

    const saveAll = async () => {
        if (pending.length === 0) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await inventoryService.saveRateBoard(date, pending);
            setNotice(`Saved ${pending.length} price${pending.length === 1 ? '' : 's'}`);
            await load(date);
        } catch (e: any) {
            setError(e?.message || 'Failed to save rates');
        } finally {
            setBusy(false);
        }
    };

    const copyYesterday = async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await inventoryService.copyPreviousRates(date);
            setNotice('Copied previous prices');
            await load(date);
        } catch (e: any) {
            setError(e?.message || 'Failed to copy previous rates');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="p-8">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/inventory/items')}
                        aria-label="Back to items"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Rate Board</h1>
                        <p className="text-slate-400 mt-1">Set the prices that apply from a date</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                        Date
                        <input
                            type="date"
                            aria-label="Rate date"
                            value={date}
                            onChange={(e) => e.target.value && setDate(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>
                    {canEdit && (
                        <>
                            <button
                                onClick={copyYesterday}
                                disabled={busy || loading}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-slate-100 px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                            >
                                <Copy size={16} />
                                Copy yesterday
                            </button>
                            <button
                                onClick={saveAll}
                                disabled={busy || loading || pending.length === 0}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                            >
                                <Save size={16} />
                                Save all{pending.length > 0 ? ` (${pending.length})` : ''}
                            </button>
                        </>
                    )}
                </div>
            </header>

            {error && (
                <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {error}
                </div>
            )}
            {notice && (
                <div role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {notice}
                </div>
            )}

            <div className="mb-4">
                <input
                    type="search"
                    placeholder="Search item or SKU"
                    aria-label="Search items"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 text-left">Item</th>
                            <th className="px-4 py-3 text-left">Unit</th>
                            <th className="px-4 py-3 text-right">Previous price</th>
                            <th className="px-4 py-3 text-right">Today's price</th>
                            <th className="px-4 py-3 text-right">Change %</th>
                            <th className="px-4 py-3" aria-label="History" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
                        ) : visible.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No items to price</td></tr>
                        ) : visible.map((e) => {
                            const key = rowKey(e);
                            const draft = drafts[key];
                            const shown = draft ?? (e.price != null ? String(e.price) : '');
                            const draftNum = draft != null && draft.trim() !== '' ? Number(draft) : null;
                            const current = draftNum != null && Number.isFinite(draftNum) ? draftNum : e.price;
                            const pct = draft != null ? changePct(e.previous_price, current) : e.change_pct;
                            const dirty = pending.some((p) => rowKey({ item_id: p.item_id, variant_id: p.variant_id ?? null }) === key);
                            return (
                                <tr key={key} data-testid={`rate-row-${key}`} className="hover:bg-slate-800/40">
                                    <td className="px-4 py-3">
                                        <div className="text-slate-100 font-medium">{e.item_name}</div>
                                        {e.sku && <div className="text-xs text-slate-500">{e.sku}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">{e.unit || '—'}</td>
                                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmt(e.previous_price)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            inputMode="decimal"
                                            aria-label={`Price for ${e.item_name}`}
                                            value={shown}
                                            disabled={!canEdit}
                                            onChange={(ev) => setDrafts((d) => ({ ...d, [key]: ev.target.value }))}
                                            className={`w-32 text-right bg-slate-950 border rounded-lg px-2 py-1.5 text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 ${dirty ? 'border-blue-500' : 'border-slate-700'}`}
                                        />
                                    </td>
                                    <td className={`px-4 py-3 text-right tabular-nums ${pctClass(pct)}`}>
                                        {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setHistoryFor(e)}
                                            aria-label={`History for ${e.item_name}`}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                                        >
                                            <History size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {historyFor && (
                <aside
                    role="complementary"
                    aria-label="Price history"
                    className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-slate-800 bg-slate-950 shadow-2xl flex flex-col"
                >
                    <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                        <div>
                            <h2 className="text-base font-semibold text-slate-100">{historyFor.item_name}</h2>
                            <p className="text-xs text-slate-500">Last 90 days up to {date}</p>
                        </div>
                        <button
                            onClick={() => setHistoryFor(null)}
                            aria-label="Close history"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        {historyLoading ? (
                            <p className="text-sm text-slate-500">Loading…</p>
                        ) : history.length === 0 ? (
                            <p className="text-sm text-slate-500">No price changes in this range</p>
                        ) : (
                            <ul className="divide-y divide-slate-800">
                                {[...history].reverse().map((h) => (
                                    <li key={h.effective_date} className="flex items-center justify-between py-2.5 text-sm">
                                        <span className="text-slate-400">{h.effective_date}</span>
                                        <span className="text-slate-100 tabular-nums">{fmt(h.price)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            )}
        </div>
    );
};

export default RateBoardPage;
