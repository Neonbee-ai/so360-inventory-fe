import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save, Send } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import {
    inventoryService,
    type LossReason,
    type ScannedItem,
    type StockCount,
    type StockCountLine,
} from '../services/inventoryService';
import ScanInput from '../components/ScanInput';
import {
    BARCODE_SCANNING_FLAG,
    MORTALITY_TRACKING_FLAG,
    changedCountLines,
    effectiveLine,
    fmtQty,
    isFlagOn,
    lineKey,
    linesMissingReason,
    visibleReasons,
    type CountDraft,
} from '../hooks/lossYield';

const varianceClass = (v: number | null): string =>
    v == null || v === 0 ? 'text-slate-400' : v > 0 ? 'text-emerald-400' : 'text-rose-400';

/**
 * Mobile-friendly count sheet: one card per line with the expected quantity,
 * a large actual-quantity field and a reason picker that appears only when
 * there is a variance. Save and Post sit in a sticky footer; Post asks for an
 * inline confirmation (no modal).
 */
const StockCountSheetPage: React.FC = () => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const shell = useShellBridge();
    const scanning = isFlagOn(shell, BARCODE_SCANNING_FLAG);
    const mortality = isFlagOn(shell, MORTALITY_TRACKING_FLAG);
    const canCount = (shell as any)?.hasPermission ? (shell as any).hasPermission('stock.adjust') !== false : true;

    const [count, setCount] = useState<StockCount | null>(null);
    const [lines, setLines] = useState<StockCountLine[]>([]);
    const [reasons, setReasons] = useState<LossReason[]>([]);
    const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [warehouseNames, setWarehouseNames] = useState<Record<string, string>>({});

    const apply = (c: StockCount) => {
        setCount(c);
        setLines(c.lines ?? []);
        setDrafts({});
    };

    /** Full load shows the spinner; a silent reload keeps the sheet and any error visible. */
    const load = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
            setError(null);
        }
        try {
            const [c, rs] = await Promise.all([
                inventoryService.getStockCount(id),
                inventoryService.getLossReasons().catch(() => [] as LossReason[]),
            ]);
            apply(c);
            setReasons(rs);
        } catch (e: any) {
            setError(e?.message || 'Failed to load stock count');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { void load(); }, [load]);

    // The count carries only warehouse_id; resolve its name from locations.
    useEffect(() => {
        Promise.resolve()
            .then(() => inventoryService.getLocations())
            .then((ws: any) => setWarehouseNames(Object.fromEntries((Array.isArray(ws) ? ws : []).map((w: any) => [w.id, w.name]))))
            .catch(() => undefined);
    }, []);

    const posted = count?.status === 'posted';
    const editable = !posted && canCount;
    const reasonOptions = useMemo(() => visibleReasons(reasons, mortality), [reasons, mortality]);
    const pending = useMemo(() => changedCountLines(lines, drafts), [lines, drafts]);
    const missing = useMemo(() => linesMissingReason(lines, drafts), [lines, drafts]);
    const counted = useMemo(
        () => lines.filter((l) => effectiveLine(l, drafts[lineKey(l)]).actual != null).length,
        [lines, drafts],
    );

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return lines;
        return lines.filter((l) =>
            (l.item_name ?? '').toLowerCase().includes(q) || (l.sku ?? '').toLowerCase().includes(q));
    }, [lines, search]);

    const setDraft = (key: string, patch: CountDraft) =>
        setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

    const focusLine = (key: string) => {
        setTimeout(() => {
            const el = document.getElementById(`actual-${key}`) as HTMLInputElement | null;
            el?.scrollIntoView?.({ block: 'center' });
            el?.focus();
        }, 0);
    };

    const onScan = (item: ScannedItem) => {
        setSearch('');
        const key = lineKey({ item_id: item.id, variant_id: item.variant_id ?? null });
        const exists = lines.some((l) => lineKey(l) === key)
            || (!item.variant_id && lines.some((l) => l.item_id === item.id));
        if (!exists) {
            setLines((ls) => [...ls, {
                item_id: item.id,
                variant_id: item.variant_id ?? null,
                item_name: item.name,
                sku: item.sku ?? null,
                unit: item.unit ?? null,
                expected_qty: 0,
                actual_qty: null,
            }]);
        }
        const target = exists ? (lines.find((l) => lineKey(l) === key) ?? lines.find((l) => l.item_id === item.id))! : null;
        focusLine(target ? lineKey(target) : key);
    };

    const save = async (): Promise<boolean> => {
        if (pending.length === 0) return true;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const updated = await inventoryService.updateStockCount(id, { lines: pending });
            if (updated?.lines) apply(updated); else await load(true);
            setNotice(`Saved ${pending.length} line${pending.length === 1 ? '' : 's'}`);
            return true;
        } catch (e: any) {
            setError(e?.message || 'Failed to save stock count');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const post = async () => {
        setConfirming(false);
        if (!(await save())) return;
        setBusy(true);
        setError(null);
        try {
            const res = await inventoryService.postStockCount(id);
            if (res?.lines) apply(res); else await load(true);
            setNotice('Count posted — variances adjusted');
        } catch (e: any) {
            setError(e?.message || 'Failed to post stock count');
            if (e?.status === 409) await load(true);
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <p className="p-8 text-center text-slate-500">Loading…</p>;

    return (
        <div className="p-4 sm:p-8 pb-32">
            <header className="mb-4 flex items-center gap-3">
                <button
                    onClick={() => navigate('/inventory/stock-counts')}
                    aria-label="Back to stock counts"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-50 truncate">
                        Count — {count?.warehouse_name || (count && warehouseNames[count.warehouse_id]) || 'Warehouse'}
                    </h1>
                    <p className="text-sm text-slate-400">
                        {count?.count_date} · {posted ? 'Posted' : 'Draft'} · {counted}/{lines.length} counted
                    </p>
                </div>
            </header>

            {error && <div role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
            {notice && <div role="status" className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

            <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {scanning && editable && <ScanInput onScan={onScan} autoFocus />}
                <input
                    type="search"
                    aria-label="Filter lines"
                    placeholder="Filter by item or SKU"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
                />
            </div>

            {visible.length === 0 ? (
                <p className="py-8 text-center text-slate-500">No lines to count</p>
            ) : (
                <ul className="space-y-2">
                    {visible.map((l) => {
                        const key = lineKey(l);
                        const d = drafts[key];
                        const { actual, reason, variance } = effectiveLine(l, d);
                        const shown = d?.actual ?? (l.actual_qty != null ? String(l.actual_qty) : '');
                        const needsReason = variance != null && variance !== 0;
                        return (
                            <li key={key} data-testid={`count-line-${key}`} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-slate-100 font-medium truncate">{l.item_name || l.item_id}</div>
                                        <div className="text-xs text-slate-500">{l.sku}{l.unit ? ` · ${l.unit}` : ''}</div>
                                    </div>
                                    <div className="text-right text-xs text-slate-400">
                                        Expected
                                        <div className="text-base text-slate-200 tabular-nums">{fmtQty(l.expected_qty)}</div>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <input
                                        id={`actual-${key}`}
                                        type="number"
                                        min={0}
                                        step="any"
                                        inputMode="decimal"
                                        aria-label={`Actual for ${l.item_name || l.item_id}`}
                                        value={shown}
                                        disabled={!editable}
                                        onChange={(e) => setDraft(key, { actual: e.target.value })}
                                        className="w-32 text-right text-lg bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className={`text-sm tabular-nums ${varianceClass(variance)}`} data-testid={`variance-${key}`}>
                                        {variance == null ? '—' : `${variance > 0 ? '+' : ''}${fmtQty(variance)}`}
                                    </span>
                                    {needsReason && (
                                        <select
                                            aria-label={`Reason for ${l.item_name || l.item_id}`}
                                            value={reason ?? ''}
                                            disabled={!editable}
                                            onChange={(e) => setDraft(key, { reason: e.target.value })}
                                            className={`flex-1 min-w-[10rem] bg-slate-950 border rounded-lg px-3 py-2 text-sm text-slate-100 ${reason ? 'border-slate-700' : 'border-amber-500'}`}
                                        >
                                            <option value="">Reason…</option>
                                            {reasonOptions.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                                        </select>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {editable && (
                <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
                        {missing.length > 0 && (
                            <span className="mr-auto text-xs text-amber-400">{missing.length} variance{missing.length === 1 ? '' : 's'} need a reason</span>
                        )}
                        <button
                            onClick={() => void save()}
                            disabled={busy || pending.length === 0}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                        >
                            <Save size={16} />
                            Save{pending.length > 0 ? ` (${pending.length})` : ''}
                        </button>
                        {confirming ? (
                            <>
                                <button
                                    onClick={() => setConfirming(false)}
                                    className="px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={post}
                                    disabled={busy}
                                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                                >
                                    <CheckCircle2 size={16} />
                                    Confirm post
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setConfirming(true)}
                                disabled={busy || missing.length > 0 || counted === 0}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                            >
                                <Send size={16} />
                                Post
                            </button>
                        )}
                    </div>
                </footer>
            )}
        </div>
    );
};

export default StockCountSheetPage;
