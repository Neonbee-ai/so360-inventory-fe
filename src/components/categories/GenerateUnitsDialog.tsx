import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Alert, Button, DataTable, TextField, type DataTableColumn, FieldGrid } from '@so360/design-system';
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

    const stackField = (field: 'bedrooms' | 'area_sqft' | 'view' | 'price', ariaSuffix: string, type?: string) =>
        (r: StackRow) => (
            <TextField
                name={`stack_${r.stack}_${field}`}
                aria-label={`Stack ${r.stack} ${ariaSuffix}`}
                type={type}
                size="sm"
                value={r[field]}
                onChange={(e) => updateRow(rows.findIndex((x) => x.stack === r.stack), { [field]: e.target.value })}
            />
        );
    const stackColumns: DataTableColumn<StackRow>[] = [
        { key: 'stack', header: 'Stack', render: (r) => <span className="text-fg-muted font-mono">{r.stack}</span> },
        { key: 'bedrooms', header: 'Bedrooms', interactive: true, render: stackField('bedrooms', 'bedrooms', 'number') },
        { key: 'area_sqft', header: 'Area (sq ft)', interactive: true, render: stackField('area_sqft', 'area', 'number') },
        { key: 'view', header: 'View', interactive: true, render: stackField('view', 'view') },
        { key: 'price', header: 'Price', interactive: true, render: stackField('price', 'price', 'number') },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Generate units — ${tower.name}`} size="lg">
            {result ? (
                <div className="space-y-4" data-testid="generate-result">
                    <p className="text-sm text-fg">
                        <span className="text-success font-semibold">{result.created}</span> units created
                        {result.skipped > 0 && (
                            <>, <span className="text-warning font-semibold">{result.skipped}</span> skipped (already exist)</>
                        )}
                        .
                    </p>
                    <div className="flex justify-end">
                        <Button variant="primary" onClick={onClose}>Done</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <FieldGrid columns={3}>
                        <TextField label="Floor from" name="floor_from" aria-label="Floor from" type="number" value={floorFrom} onChange={(e) => setFloorFrom(e.target.value)} />
                        <TextField label="Floor to" name="floor_to" aria-label="Floor to" type="number" value={floorTo} onChange={(e) => setFloorTo(e.target.value)} />
                        <TextField label="Units per floor" name="units_per_floor" aria-label="Units per floor" type="number" min={1} max={99} value={unitsPerFloor} onChange={(e) => handleUnitsPerFloor(e.target.value)} />
                    </FieldGrid>

                    <FieldGrid>
                        <TextField label="Numbering pattern" name="numbering_pattern" aria-label="Numbering pattern" hint="Use {floor} and {stack:02}" value={pattern} onChange={(e) => setPattern(e.target.value)} />
                        <TextField label="SKU prefix" name="sku_prefix" aria-label="SKU prefix" value={skuPrefix} onChange={(e) => setSkuPrefix(e.target.value)} />
                    </FieldGrid>

                    {rows.length > 0 && (
                        <DataTable<StackRow>
                            data-testid="generate-units-stacks"
                            density="compact"
                            rows={rows}
                            rowKey={(r) => r.stack}
                            columns={stackColumns}
                        />
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-line">
                        <div className="text-sm">
                            <span className="text-fg-muted" data-testid="preview-count">Preview: {count} units</span>
                            {examples.length > 0 && (
                                <span className="text-fg-subtle ml-2">({examples.join(' … ')})</span>
                            )}
                            {tooMany && (
                                <span className="block text-nb-overline text-danger">At most {MAX_UNITS_PER_RUN} units per run</span>
                            )}
                            {error && <Alert variant="error">{error}</Alert>}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleSubmit}
                                disabled={!canSubmit}
                            >{submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Create {count} units
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default GenerateUnitsDialog;
