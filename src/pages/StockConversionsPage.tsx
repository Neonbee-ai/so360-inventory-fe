import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import {
    inventoryService,
    type LossReason,
    type ScannedItem,
    type StockConversion,
} from '../services/inventoryService';
import ItemSearchSelector from '../components/ItemSearchSelector';
import ScanInput from '../components/ScanInput';
import {
    BARCODE_SCANNING_FLAG,
    MORTALITY_TRACKING_FLAG,
    conversionYield,
    fmtQty,
    isFlagOn,
    isoDate,
    parseQty,
    shiftDays,
    visibleReasons,
} from '../hooks/lossYield';

/** `id` is the item (the parent for a variant); `variant_id` the variant stock row. */
interface Picked { id: string; name: string; variant_id?: string | null }
interface OutputRow { uid: number; item: Picked | null; qty: string }

let uidSeq = 0;
const newRow = (): OutputRow => ({ uid: ++uidSeq, item: null, qty: '' });

/** The items row that carries stock: the variant row when present. */
const stockRowOf = (p: Picked) => p.variant_id || p.id;

/** Idempotency key for one conversion form; reused on retry, renewed after success. */
export const newClientRef = (): string => {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
};

/**
 * Conversion / yield entry: one input item and quantity becomes one or more
 * output items. Yield % and loss update live; the loss is what the server
 * books against the chosen reason.
 */
const StockConversionsPage: React.FC = () => {
    const shell = useShellBridge();
    const scanning = isFlagOn(shell, BARCODE_SCANNING_FLAG);
    const mortality = isFlagOn(shell, MORTALITY_TRACKING_FLAG);
    const canRecord = (shell as any)?.hasPermission ? (shell as any).hasPermission('stock.adjust') !== false : true;

    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [reasons, setReasons] = useState<LossReason[]>([]);
    const [recent, setRecent] = useState<StockConversion[]>([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [date, setDate] = useState(() => isoDate(new Date()));
    const [input, setInput] = useState<Picked | null>(null);
    const [inputQty, setInputQty] = useState('');
    const [outputs, setOutputs] = useState<OutputRow[]>(() => [newRow()]);
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [clientRef, setClientRef] = useState(newClientRef);
    const [names, setNames] = useState<Record<string, string>>({});

    const loadRecent = useCallback(async () => {
        const today = isoDate(new Date());
        const rows = await inventoryService.getStockConversions({ from: shiftDays(today, -7), to: today }).catch(() => []);
        setRecent(rows);
    }, []);

    useEffect(() => {
        (async () => {
            const [wh, rs] = await Promise.all([
                inventoryService.getLocations().catch(() => []),
                inventoryService.getLossReasons().catch(() => [] as LossReason[]),
            ]);
            const whs = Array.isArray(wh) ? wh : [];
            setWarehouses(whs);
            if (whs.length === 1) setWarehouseId(whs[0].id);
            setReasons(rs);
        })();
        void loadRecent();
    }, [loadRecent]);

    const reasonOptions = useMemo(() => visibleReasons(reasons, mortality), [reasons, mortality]);
    useEffect(() => {
        if (reason || reasonOptions.length === 0) return;
        setReason((reasonOptions.find((r) => r.category === 'process') ?? reasonOptions[0]).code);
    }, [reasonOptions, reason]);

    const inQty = parseQty(inputQty);
    const calc = useMemo(
        () => conversionYield(inQty, outputs.map((o) => parseQty(o.qty))),
        [inQty, outputs],
    );
    const validOutputs = outputs.filter((o) => o.item && (parseQty(o.qty) ?? 0) > 0);
    const canSave = !!warehouseId && !!input && inQty != null && inQty > 0
        && validOutputs.length > 0 && calc.loss != null && calc.loss >= 0 && !busy;

    const updateRow = (uid: number, patch: Partial<OutputRow>) =>
        setOutputs((rows) => rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

    const onScan = (item: ScannedItem) => {
        const picked: Picked = { id: item.id, name: item.name, variant_id: item.variant_id ?? null };
        if (!input) { setInput(picked); return; }
        setOutputs((rows) => {
            const blank = rows.find((r) => !r.item);
            return blank ? rows.map((r) => (r === blank ? { ...r, item: picked } : r)) : [...rows, { ...newRow(), item: picked }];
        });
    };

    const reset = () => {
        setInput(null);
        setInputQty('');
        setOutputs([newRow()]);
        setNotes('');
    };

    const save = async () => {
        if (!canSave || !input || inQty == null || calc.loss == null) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const inputRow = stockRowOf(input);
            await inventoryService.createStockConversion({
                client_ref: clientRef,
                warehouse_id: warehouseId,
                conversion_date: date,
                input_item_id: inputRow,
                input_qty: inQty,
                outputs: validOutputs.map((o) => ({
                    item_id: o.item!.id,
                    variant_id: o.item!.variant_id ?? null,
                    qty: parseQty(o.qty)!,
                })),
                loss_qty: calc.loss,
                ...(reason ? { reason_code: reason } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            });
            setNotice(`Recorded — yield ${calc.yieldPct?.toFixed(2)}%`);
            setNames((m) => ({ ...m, [inputRow]: input.name }));
            setClientRef(newClientRef());
            reset();
            void loadRecent();
        } catch (e: any) {
            setError(e?.message || 'Failed to record conversion');
        } finally {
            setBusy(false);
        }
    };

    const fieldCls = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100';

    return (
        <div className="p-4 sm:p-8">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">Conversion &amp; Yield</h1>
                <p className="text-slate-400 mt-1">Turn one item into others and track the loss in between</p>
            </header>

            {error && <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
            {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

            <section aria-label="New conversion" className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-slate-400">
                        Warehouse
                        <select aria-label="Warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={`mt-1 ${fieldCls}`}>
                            <option value="">Select warehouse</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm text-slate-400">
                        Date
                        <input type="date" aria-label="Conversion date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`mt-1 ${fieldCls}`} />
                    </label>
                </div>

                {scanning && canRecord && (
                    <ScanInput onScan={onScan} placeholder={input ? 'Scan an output item' : 'Scan the input item'} />
                )}

                <fieldset>
                    <legend className="mb-1 text-sm font-semibold text-slate-300">Input</legend>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <ItemSearchSelector
                            className="flex-1"
                            value={input?.id ?? ''}
                            selectedName={input?.name}
                            onSelect={(it) => setInput({ id: it.id, name: it.name })}
                        />
                        <input
                            type="number" min={0} step="any" inputMode="decimal"
                            aria-label="Input quantity" placeholder="Qty"
                            value={inputQty} onChange={(e) => setInputQty(e.target.value)}
                            className="sm:w-32 text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 tabular-nums"
                        />
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="mb-1 text-sm font-semibold text-slate-300">Outputs</legend>
                    <div className="space-y-2">
                        {outputs.map((o, i) => (
                            <div key={o.uid} className="flex flex-col sm:flex-row gap-2">
                                <ItemSearchSelector
                                    className="flex-1"
                                    value={o.item?.id ?? ''}
                                    selectedName={o.item?.name}
                                    onSelect={(it) => updateRow(o.uid, { item: { id: it.id, name: it.name } })}
                                />
                                <div className="flex gap-2">
                                    <input
                                        type="number" min={0} step="any" inputMode="decimal"
                                        aria-label={`Output ${i + 1} quantity`} placeholder="Qty"
                                        value={o.qty} onChange={(e) => updateRow(o.uid, { qty: e.target.value })}
                                        className="flex-1 sm:w-32 text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 tabular-nums"
                                    />
                                    {outputs.length > 1 && (
                                        <button
                                            onClick={() => setOutputs((rows) => rows.filter((r) => r.uid !== o.uid))}
                                            aria-label={`Remove output ${i + 1}`}
                                            className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setOutputs((rows) => [...rows, newRow()])}
                        className="mt-2 flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
                    >
                        <Plus size={14} /> Add output
                    </button>
                </fieldset>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-950/60 p-3 text-center" aria-label="Yield summary">
                    <div>
                        <div className="text-xs text-slate-500">Output</div>
                        <div className="text-lg text-slate-100 tabular-nums" data-testid="output-total">{fmtQty(calc.output)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Loss</div>
                        <div className={`text-lg tabular-nums ${calc.loss != null && calc.loss < 0 ? 'text-rose-400' : 'text-amber-300'}`} data-testid="loss-qty">{fmtQty(calc.loss)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Yield</div>
                        <div className="text-lg text-emerald-300 tabular-nums" data-testid="yield-pct">
                            {calc.yieldPct == null ? '—' : `${calc.yieldPct.toFixed(2)}%`}
                        </div>
                    </div>
                </div>
                {calc.loss != null && calc.loss < 0 && (
                    <p className="text-xs text-rose-400">Outputs exceed the input quantity</p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-slate-400">
                        Loss reason
                        <select aria-label="Loss reason" value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1 ${fieldCls}`}>
                            {reasonOptions.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                        </select>
                    </label>
                    <label className="text-sm text-slate-400">
                        Notes
                        <input aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${fieldCls}`} />
                    </label>
                </div>

                {canRecord && (
                    <button
                        onClick={save}
                        disabled={!canSave}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                    >
                        Record conversion
                    </button>
                )}
            </section>

            <section aria-label="Recent conversions" className="mt-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Last 7 days</h2>
                {recent.length === 0 ? (
                    <p className="text-sm text-slate-500">No conversions recorded</p>
                ) : (
                    <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
                        {recent.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                                <div className="min-w-0">
                                    <div className="text-slate-100 truncate">{c.input_item_name || names[c.input_item_id] || c.input_item_id}</div>
                                    <div className="text-xs text-slate-500">{c.conversion_date} · in {fmtQty(c.input_qty)} · loss {fmtQty(c.loss_qty)}</div>
                                </div>
                                <span className="text-emerald-300 tabular-nums">
                                    {c.yield_pct == null ? '—' : `${Number(c.yield_pct).toFixed(2)}%`}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default StockConversionsPage;
