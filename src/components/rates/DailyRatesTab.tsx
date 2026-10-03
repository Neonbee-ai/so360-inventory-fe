import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Copy, Download, History, Percent, Save, Upload } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import { inventoryService, type RateBoardEntry } from '../../services/inventoryService';
import {
    JUMP_WARN_PCT,
    RATE_SAVE_CHUNK,
    applyShift,
    changePct,
    changedEntries,
    chunk,
    parseRatesCsv,
    reviewSummary,
    rowKey,
    toIsoDate,
    toRatesCsv,
    type CsvRowError,
    type ShiftMode,
} from '../../hooks/rateBoard';

const fmt = (v: number | null | undefined): string =>
    v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const pctClass = (p: number | null): string =>
    p == null || p === 0 ? 'text-slate-400' : p > 0 ? 'text-emerald-400' : 'text-rose-400';

const btn = 'flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-slate-100 px-3 py-2 rounded-lg font-semibold text-sm disabled:opacity-50';
const field = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

/**
 * "Daily rates" tab of the Items page (formerly the standalone Rate Board).
 * Price column is editable; a whole category can be shifted by % or amount;
 * the board round-trips as CSV. Every save goes through a review screen
 * (counts, largest jump, apply now or on a later date) and is sent in chunks.
 */
const DailyRatesTab: React.FC = () => {
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

    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [shiftCategory, setShiftCategory] = useState('');
    const [shiftMode, setShiftMode] = useState<ShiftMode>('pct');
    const [shiftBy, setShiftBy] = useState('');

    const [csvErrors, setCsvErrors] = useState<CsvRowError[]>([]);
    const [source, setSource] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const [reviewing, setReviewing] = useState(false);
    const [when, setWhen] = useState<'now' | 'schedule'>('now');
    const [scheduleDate, setScheduleDate] = useState('');

    const load = useCallback(async (d: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await inventoryService.getRateBoard(d);
            setEntries(res?.entries ?? []);
            setDrafts({});
            setSource(null);
        } catch (e: any) {
            setError(e?.message || 'Failed to load daily rates');
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(date); }, [date, load]);

    useEffect(() => {
        Promise.resolve()
            .then(() => inventoryService.getSettings())
            .then((s: any) => setCategories(Array.isArray(s?.categories) ? s.categories : []))
            .catch(() => setCategories([]));
    }, []);

    const pending = useMemo(() => changedEntries(entries, drafts), [entries, drafts]);
    const summary = useMemo(() => reviewSummary(entries, drafts), [entries, drafts]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((e) =>
            e.item_name?.toLowerCase().includes(q) || (e.sku ?? '').toLowerCase().includes(q));
    }, [entries, search]);

    const applyCategoryShift = async () => {
        const by = Number(shiftBy);
        if (!Number.isFinite(by) || by === 0) return;
        setError(null);
        let ids: Set<string> | null = null;
        if (shiftCategory) {
            setBusy(true);
            try {
                const res: any = await inventoryService.getItems({ categoryId: shiftCategory, limit: 1000 });
                ids = new Set((res?.data ?? []).map((i: any) => i.id));
            } catch (e: any) {
                setError(e?.message || 'Failed to load category items');
                setBusy(false);
                return;
            } finally {
                setBusy(false);
            }
        }
        setDrafts((d) => applyShift(entries, d, ids, shiftMode, by));
        setSource(`shift ${shiftMode === 'pct' ? `${by > 0 ? '+' : ''}${by}%` : `${by > 0 ? '+' : ''}${by}`}`);
    };

    const downloadCsv = () => {
        const blob = new Blob([toRatesCsv(entries, drafts)], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rates_${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const uploadCsv = async (file: File) => {
        setError(null);
        setNotice(null);
        const text = await file.text();
        const res = parseRatesCsv(text, entries);
        setCsvErrors(res.errors);
        setDrafts((d) => ({ ...d, ...res.drafts }));
        setSource(`CSV ${file.name}`);
        if (Object.keys(res.drafts).length > 0 && res.errors.length === 0) setReviewing(true);
    };

    const effectiveDate = when === 'schedule' && scheduleDate ? scheduleDate : date;

    const saveAll = async () => {
        if (pending.length === 0) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        const parts = chunk(pending, RATE_SAVE_CHUNK);
        let saved = 0;
        try {
            for (const part of parts) {
                await inventoryService.saveRateBoard(effectiveDate, part);
                saved += part.length;
            }
            setNotice(`Saved ${saved} price${saved === 1 ? '' : 's'}${effectiveDate !== date ? ` effective ${effectiveDate}` : ''}`);
            setReviewing(false);
            setWhen('now');
            await load(date);
        } catch (e: any) {
            const msg = e?.message || 'Failed to save rates';
            setError(saved > 0 ? `${msg} (${saved} of ${pending.length} saved)` : msg);
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

    const banners = (
        <>
            {error && <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
            {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}
        </>
    );

    if (reviewing) {
        const jump = summary.largest;
        return (
            <section aria-label="Review prices" className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 max-w-2xl">
                {banners}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-100">{summary.change} item{summary.change === 1 ? '' : 's'} will change</h2>
                    {source && <span className="text-xs text-slate-500">from {source}</span>}
                </div>
                <p className="mt-2 text-sm text-slate-300" data-testid="review-counts">
                    Up {summary.up} · Down {summary.down} · Unchanged {summary.unchanged} skipped
                </p>
                {jump && (
                    <p className={`mt-1 text-sm flex items-center gap-1.5 ${Math.abs(jump.pct) > JUMP_WARN_PCT ? 'text-amber-300' : 'text-slate-400'}`} data-testid="review-jump">
                        Largest jump: {jump.name} {jump.pct > 0 ? '+' : ''}{jump.pct.toFixed(2)}%
                        {Math.abs(jump.pct) > JUMP_WARN_PCT && <><AlertTriangle size={14} /> check</>}
                    </p>
                )}
                <fieldset className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-300">
                    <legend className="sr-only">When</legend>
                    <label className="flex items-center gap-2">
                        <input type="radio" name="when" checked={when === 'now'} onChange={() => setWhen('now')} />
                        Apply on {date}
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="radio" name="when" checked={when === 'schedule'} onChange={() => setWhen('schedule')} />
                        Schedule
                    </label>
                    {when === 'schedule' && (
                        <input type="date" aria-label="Schedule date" min={date} value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)} className={field} />
                    )}
                </fieldset>
                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={() => setReviewing(false)} disabled={busy} className={btn}>Back</button>
                    <button
                        onClick={saveAll}
                        disabled={busy || pending.length === 0 || (when === 'schedule' && !scheduleDate)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                    >
                        <Save size={16} />
                        Save {pending.length} price{pending.length === 1 ? '' : 's'}
                    </button>
                </div>
            </section>
        );
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-400">
                    Date
                    <input type="date" aria-label="Rate date" value={date}
                        onChange={(e) => e.target.value && setDate(e.target.value)} className={field} />
                </label>
                <input type="search" placeholder="Search item or SKU" aria-label="Search items" value={search}
                    onChange={(e) => setSearch(e.target.value)} className={`${field} flex-1 min-w-[12rem] max-w-sm`} />
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button onClick={downloadCsv} disabled={loading || entries.length === 0} className={btn}>
                        <Download size={16} /> Download CSV
                    </button>
                    {canEdit && (
                        <>
                            <button onClick={() => fileRef.current?.click()} disabled={busy || loading} className={btn}>
                                <Upload size={16} /> Upload CSV
                            </button>
                            <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label="Rates CSV file" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCsv(f); e.target.value = ''; }} />
                            <button onClick={copyYesterday} disabled={busy || loading} className={btn}>
                                <Copy size={16} /> Copy yesterday
                            </button>
                            <button
                                onClick={() => setReviewing(true)}
                                disabled={busy || loading || pending.length === 0}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                            >
                                <Save size={16} />
                                Review{pending.length > 0 ? ` (${pending.length})` : ''}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {canEdit && (
                <div role="group" aria-label="Shift prices" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-400">
                    <Percent size={14} />
                    Shift
                    <select aria-label="Shift category" value={shiftCategory} onChange={(e) => setShiftCategory(e.target.value)} className={field}>
                        <option value="">All items</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    by
                    <input type="number" step="any" aria-label="Shift amount" placeholder="e.g. 5 or -3" value={shiftBy}
                        onChange={(e) => setShiftBy(e.target.value)} className={`${field} w-28 text-right`} />
                    <select aria-label="Shift unit" value={shiftMode} onChange={(e) => setShiftMode(e.target.value as ShiftMode)} className={field}>
                        <option value="pct">%</option>
                        <option value="amount">Rs</option>
                    </select>
                    <button onClick={() => void applyCategoryShift()} disabled={busy || loading || !shiftBy || Number(shiftBy) === 0} className={btn}>
                        Apply to list
                    </button>
                </div>
            )}

            {banners}
            {csvErrors.length > 0 && (
                <div role="alert" aria-label="CSV errors" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    <p className="font-semibold">{csvErrors.length} row{csvErrors.length === 1 ? '' : 's'} skipped — valid rows are in the list</p>
                    <ul className="mt-1 list-disc pl-5">
                        {csvErrors.slice(0, 20).map((er) => <li key={`${er.line}-${er.message}`}>Line {er.line}: {er.message}</li>)}
                    </ul>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 text-left">Item</th>
                            <th className="px-4 py-3 text-left">Unit</th>
                            <th className="px-4 py-3 text-right">Previous price</th>
                            <th className="px-4 py-3 text-right">Price</th>
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
                                            type="number" min={0} step="any" inputMode="decimal"
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
                                            onClick={() => navigate(`/inventory/items/${e.item_id}?tab=price-history${e.variant_id ? `&variant=${e.variant_id}` : ''}`)}
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
        </div>
    );
};

export default DailyRatesTab;
