import React from 'react';
import { CheckCircle2, XCircle, Package, RotateCcw } from 'lucide-react';
import { Button, Spinner } from '@so360/design-system';

interface RowResult {
    row_index: number;
    status: 'success' | 'error';
    item_id?: string;
    sku?: string;
    reason?: string;
}

interface Props {
    result: { total: number; succeeded: number; failed: number; results: RowResult[] } | null;
    loading: boolean;
    submittedRows: any[];
    onGoToItems: () => void;
    onReset: () => void;
    onNavigateToItem: (id: string) => void;
}

const ImportResultStep: React.FC<Props> = ({ result, loading, submittedRows, onGoToItems, onReset, onNavigateToItem }) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center gap-nb-4 py-nb-10">
                <Spinner label="Importing" />
                <p className="text-fg-muted text-nb-caption" aria-busy="true">Importing {submittedRows.length} items…</p>
            </div>
        );
    }

    if (!result) return null;

    const successes = result.results.filter(r => r.status === 'success');
    const failures  = result.results.filter(r => r.status === 'error');

    return (
        <div className="max-w-2xl mx-auto space-y-nb-6">
            {/* Header */}
            <div className="flex items-center gap-nb-4">
                <div className={`w-14 h-14 rounded-nb-lg flex items-center justify-center border ${
                    result.failed === 0
                        ? 'bg-surface-raised border-success'
                        : 'bg-surface-raised border-warning'
                }`}>
                    {result.failed === 0
                        ? <CheckCircle2 size={28} className="text-success" />
                        : <Package size={28} className="text-warning" />
                    }
                </div>
                <div>
                    <p className="text-fg font-bold text-nb-title">
                        {result.failed === 0 ? 'Import complete' : 'Partial import'}
                    </p>
                    <p className="text-fg-muted text-nb-caption">
                        {result.succeeded} succeeded · {result.failed} failed
                    </p>
                </div>
            </div>

            {/* Successes */}
            {successes.length > 0 && (
                <div className="space-y-nb-2">
                    <p className="text-success text-nb-caption font-semibold uppercase">Imported items</p>
                    <div className="max-h-48 overflow-y-auto space-y-nb-1 pr-nb-1">
                        {successes.map((r) => {
                            const name = submittedRows[r.row_index - 1]?.name || `Row ${r.row_index}`;
                            return (
                                <button
                                    key={r.row_index}
                                    onClick={() => r.item_id && onNavigateToItem(r.item_id)}
                                    className="w-full flex items-center gap-nb-3 px-nb-3 py-nb-2 rounded-nb-md bg-surface border border-line hover:bg-surface-raised text-left"
                                >
                                    <CheckCircle2 size={13} className="text-success shrink-0" />
                                    <span className="text-fg text-nb-caption flex-1 truncate">{name}</span>
                                    <span className="text-fg-subtle text-nb-caption font-mono">
                                        {r.sku ? `SKU ${r.sku}` : `${r.item_id?.slice(0, 8)}…`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Failures */}
            {failures.length > 0 && (
                <div className="space-y-nb-2">
                    <p className="text-danger text-nb-caption font-semibold uppercase">Failed rows</p>
                    <div className="space-y-nb-1">
                        {failures.map((r) => (
                            <div key={r.row_index} className="flex items-start gap-nb-3 px-nb-3 py-nb-2 rounded-nb-md bg-surface border border-danger">
                                <XCircle size={13} className="text-danger shrink-0" />
                                <div>
                                    <span className="text-fg-muted text-nb-caption">Row {r.row_index}</span>
                                    <span className="text-danger text-nb-caption ml-nb-2">{r.reason}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-nb-3 pt-nb-2">
                <Button variant="primary" onClick={onGoToItems}>
                    <Package size={16} />
                    Go to Items
                </Button>
                <Button variant="secondary" onClick={onReset}>
                    <RotateCcw size={15} />
                    Start new import
                </Button>
            </div>
        </div>
    );
};

export default ImportResultStep;
