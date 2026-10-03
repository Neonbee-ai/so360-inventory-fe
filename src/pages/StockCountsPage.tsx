import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus, X } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import { inventoryService, type StockCount } from '../services/inventoryService';
import { isoDate } from '../hooks/lossYield';

/** URL of a count sheet inside Stock Overview's Count mode. */
export const countSheetUrl = (id: string): string => `/inventory/overview?mode=count&count=${encodeURIComponent(id)}`;

interface Props {
    /** Opens a count's sheet; defaults to Stock Overview's Count mode URL. */
    onOpen?: (id: string) => void;
    /** Rendered inside another page: no page padding and a smaller title. */
    embedded?: boolean;
}

/**
 * Stock count list (Count mode of Stock Overview). "New count" opens an inline
 * form (warehouse + date) that starts a draft and goes straight to its count
 * sheet — three taps, no modal.
 */
const StockCountsPage: React.FC<Props> = ({ onOpen, embedded = false }) => {
    const navigate = useNavigate();
    const open = (id: string) => (onOpen ? onOpen(id) : navigate(countSheetUrl(id)));
    const shell = useShellBridge();
    const canCount = (shell as any)?.hasPermission ? (shell as any).hasPermission('stock.adjust') !== false : true;

    const [counts, setCounts] = useState<StockCount[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [busy, setBusy] = useState(false);
    const [warehouseId, setWarehouseId] = useState('');
    const [countDate, setCountDate] = useState(() => isoDate(new Date()));

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [list, wh] = await Promise.all([
                inventoryService.getStockCounts(),
                inventoryService.getLocations().catch(() => []),
            ]);
            setCounts(list);
            const whs = Array.isArray(wh) ? wh : [];
            setWarehouses(whs);
            if (whs.length === 1) setWarehouseId(whs[0].id);
        } catch (e: any) {
            setError(e?.message || 'Failed to load stock counts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const whName = useMemo(() => {
        const m = new Map<string, string>();
        for (const w of warehouses) m.set(w.id, w.name);
        return (c: StockCount) => c.warehouse_name || m.get(c.warehouse_id) || '—';
    }, [warehouses]);

    const start = async () => {
        if (!warehouseId) return;
        setBusy(true);
        setError(null);
        try {
            const created = await inventoryService.createStockCount({ warehouse_id: warehouseId, count_date: countDate });
            open(created.id);
        } catch (e: any) {
            setError(e?.message || 'Failed to start stock count');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={embedded ? '' : 'p-4 sm:p-8'}>
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    {embedded
                        ? <h2 className="text-lg font-semibold text-slate-50">Stock counts</h2>
                        : <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">Stock Counts</h1>}
                    <p className="text-slate-400 mt-1">Count shelves, record variances with a reason, then post</p>
                </div>
                {canCount && !creating && (
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm"
                    >
                        <Plus size={16} />
                        New count
                    </button>
                )}
            </header>

            {creating && (
                <section aria-label="New count" className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                    <label className="flex-1 text-sm text-slate-400">
                        Warehouse
                        <select
                            aria-label="Warehouse"
                            value={warehouseId}
                            onChange={(e) => setWarehouseId(e.target.value)}
                            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100"
                        >
                            <option value="">Select warehouse</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm text-slate-400">
                        Count date
                        <input
                            type="date"
                            aria-label="Count date"
                            value={countDate}
                            onChange={(e) => e.target.value && setCountDate(e.target.value)}
                            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                        />
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={start}
                            disabled={!warehouseId || busy}
                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                        >
                            Start count
                        </button>
                        <button
                            onClick={() => setCreating(false)}
                            aria-label="Cancel new count"
                            className="p-2.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </section>
            )}

            {error && (
                <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
            )}

            {loading ? (
                <p className="py-8 text-center text-slate-500">Loading…</p>
            ) : counts.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                    <ClipboardCheck size={32} className="mx-auto mb-3 text-slate-600" />
                    No stock counts yet
                </div>
            ) : (
                <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
                    {counts.map((c) => (
                        <li key={c.id}>
                            <button
                                onClick={() => open(c.id)}
                                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-800/40"
                            >
                                <div className="min-w-0">
                                    <div className="text-slate-100 font-medium">{whName(c)}</div>
                                    <div className="text-xs text-slate-500">{c.count_date}</div>
                                </div>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.status === 'posted' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}
                                >
                                    {c.status === 'posted' ? 'Posted' : 'Draft'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default StockCountsPage;
