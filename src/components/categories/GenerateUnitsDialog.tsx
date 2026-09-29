import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal';
import { inventoryService } from '../../services/inventoryService';
import type { GenerateUnitsResult, UnitStackSpec } from '../../types/inventory';
import {
    DEFAULT_NUMBERING_PATTERN,
    MAX_UNITS_PER_RUN,
    defaultStackLabels,
    formatUnitNumber,
    previewUnitCount,
} from '../../utils/unitGrid';

interface GenerateUnitsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tower: { id: string; name: string };
    /** Called after a successful run so the caller can refresh counts. */
    onGenerated?: (result: GenerateUnitsResult) => void;
}

interface StackRow {
    stack: string;
    bedrooms: string;
    area_sqft: string;
    view: string;
    price: string;
}

const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500';
const cellCls =
    'w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500';

export function suggestSkuPrefix(name: string): string {
    const clean = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.slice(0, 6) || 'UNIT';
}

const numOrNull = (v: string): number | null => {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const emptyRow = (stack: string): StackRow => ({ stack, bedrooms: '', area_sqft: '', view: '', price: '' });

/**
 * Bulk-create units on a tower. Opens from the page only — never on top of
 * another modal — and shows the result in place instead of a second dialog.
 */
export const GenerateUnitsDialog: React.FC<GenerateUnitsDialogProps> = ({ isOpen, onClose, tower, onGenerated }) => {
    const [floorFrom, setFloorFrom] = useState('1');
    const [floorTo, setFloorTo] = useState('10');
    const [unitsPerFloor, setUnitsPerFloor] = useState('4');
    const [pattern, setPattern] = useState(DEFAULT_NUMBERING_PATTERN);
    const [skuPrefix, setSkuPrefix] = useState(suggestSkuPrefix(tower.name));
    const [rows, setRows] = useState<StackRow[]>(defaultStackLabels(4).map(emptyRow));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<GenerateUnitsResult | null>(null);

    // Fresh form each time the dialog opens for a tower.
    useEffect(() => {
        if (!isOpen) return;
        setFloorFrom('1');
        setFloorTo('10');
        setUnitsPerFloor('4');
        setPattern(DEFAULT_NUMBERING_PATTERN);
        setSkuPrefix(suggestSkuPrefix(tower.name));
        setRows(defaultStackLabels(4).map(emptyRow));
        setError(null);
        setResult(null);
    }, [isOpen, tower.id, tower.name]);

    // One stack row per unit on a floor; keep what was typed in surviving rows.
    const handleUnitsPerFloor = (v: string) => {
        setUnitsPerFloor(v);
        const labels = defaultStackLabels(Number(v));
        setRows((prev) => labels.map((label, i) => (prev[i] ? { ...prev[i], stack: label } : emptyRow(label))));
    };

    const updateRow = (i: number, patch: Partial<StackRow>) =>
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

    const count = previewUnitCount(floorFrom, floorTo, unitsPerFloor);
    const examples = useMemo(() => {
        if (!count || rows.length === 0) return [];
        const from = Number(floorFrom);
        const to = Number(floorTo);
        const first = formatUnitNumber(pattern, from, rows[0].stack);
        const last = formatUnitNumber(pattern, to, rows[rows.length - 1].stack);
        return first === last ? [first] : [first, last];
    }, [count, floorFrom, floorTo, pattern, rows]);

    const tooMany = count > MAX_UNITS_PER_RUN;
    const canSubmit = count > 0 && !tooMany && skuPrefix.trim() !== '' && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const stacks: UnitStackSpec[] = rows.map((r) => ({
                stack: r.stack,
                bedrooms: numOrNull(r.bedrooms),
                area_sqft: numOrNull(r.area_sqft),
                view: r.view.trim() || null,
                price: numOrNull(r.price),
            }));
            const res = await inventoryService.generateUnits(tower.id, {
                floor_from: Number(floorFrom),
                floor_to: Number(floorTo),
                units_per_floor: Number(unitsPerFloor),
                numbering_pattern: pattern.trim() || DEFAULT_NUMBERING_PATTERN,
                sku_prefix: skuPrefix.trim(),
                stacks,
            });
            setResult(res);
            onGenerated?.(res);
        } catch (err: any) {
            setError(err?.message || 'Failed to generate units');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Generate units — ${tower.name}`} size="lg">
            {result ? (
                <div className="space-y-4" data-testid="generate-result">
                    <p className="text-sm text-slate-200">
                        <span className="text-emerald-400 font-semibold">{result.created}</span> units created
                        {result.skipped > 0 && (
                            <>, <span className="text-amber-400 font-semibold">{result.skipped}</span> skipped (already exist)</>
                        )}
                        .
                    </p>
                    <div className="flex justify-end">
                        <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                            Done
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                        <label className="block">
                            <span className="block text-xs text-slate-400 mb-1">Floor from</span>
                            <input aria-label="Floor from" type="number" className={inputCls} value={floorFrom} onChange={(e) => setFloorFrom(e.target.value)} />
                        </label>
                        <label className="block">
                            <span className="block text-xs text-slate-400 mb-1">Floor to</span>
                            <input aria-label="Floor to" type="number" className={inputCls} value={floorTo} onChange={(e) => setFloorTo(e.target.value)} />
                        </label>
                        <label className="block">
                            <span className="block text-xs text-slate-400 mb-1">Units per floor</span>
                            <input aria-label="Units per floor" type="number" min={1} max={99} className={inputCls} value={unitsPerFloor} onChange={(e) => handleUnitsPerFloor(e.target.value)} />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="block text-xs text-slate-400 mb-1">Numbering pattern</span>
                            <input aria-label="Numbering pattern" className={inputCls} value={pattern} onChange={(e) => setPattern(e.target.value)} />
                            <span className="block text-[11px] text-slate-500 mt-1">Use {'{floor}'} and {'{stack:02}'}</span>
                        </label>
                        <label className="block">
                            <span className="block text-xs text-slate-400 mb-1">SKU prefix</span>
                            <input aria-label="SKU prefix" className={inputCls} value={skuPrefix} onChange={(e) => setSkuPrefix(e.target.value)} />
                        </label>
                    </div>

                    {rows.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-500 text-left">
                                        <th className="py-1 pr-2 font-medium">Stack</th>
                                        <th className="py-1 pr-2 font-medium">Bedrooms</th>
                                        <th className="py-1 pr-2 font-medium">Area (sq ft)</th>
                                        <th className="py-1 pr-2 font-medium">View</th>
                                        <th className="py-1 font-medium">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.stack}>
                                            <td className="py-1 pr-2 text-slate-300 font-mono">{r.stack}</td>
                                            <td className="py-1 pr-2"><input aria-label={`Stack ${r.stack} bedrooms`} type="number" className={cellCls} value={r.bedrooms} onChange={(e) => updateRow(i, { bedrooms: e.target.value })} /></td>
                                            <td className="py-1 pr-2"><input aria-label={`Stack ${r.stack} area`} type="number" className={cellCls} value={r.area_sqft} onChange={(e) => updateRow(i, { area_sqft: e.target.value })} /></td>
                                            <td className="py-1 pr-2"><input aria-label={`Stack ${r.stack} view`} className={cellCls} value={r.view} onChange={(e) => updateRow(i, { view: e.target.value })} /></td>
                                            <td className="py-1"><input aria-label={`Stack ${r.stack} price`} type="number" className={cellCls} value={r.price} onChange={(e) => updateRow(i, { price: e.target.value })} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                        <div className="text-sm">
                            <span className="text-slate-300" data-testid="preview-count">Preview: {count} units</span>
                            {examples.length > 0 && (
                                <span className="text-slate-500 ml-2">({examples.join(' … ')})</span>
                            )}
                            {tooMany && (
                                <span className="block text-[11px] text-rose-400">At most {MAX_UNITS_PER_RUN} units per run</span>
                            )}
                            {error && <span className="block text-[11px] text-rose-400">{error}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                            >
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Create {count} units
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default GenerateUnitsDialog;
