import React from 'react';
import { CheckCircle2, XCircle, Package, RotateCcw, Loader2 } from 'lucide-react';

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
            <div className="flex flex-col items-center gap-4 py-16">
                <Loader2 size={36} className="text-primary animate-spin" />
                <p className="text-fg-muted text-sm">Importing {submittedRows.length} items…</p>
            </div>
        );
    }

    if (!result) return null;

    const successes = result.results.filter(r => r.status === 'success');
    const failures  = result.results.filter(r => r.status === 'error');

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${
                    result.failed === 0
                        ? 'bg-success/10 border-success/20'
                        : 'bg-warning/10 border-warning/20'
                }`}>
                    {result.failed === 0
                        ? <CheckCircle2 size={28} className="text-success" />
                        : <Package size={28} className="text-warning" />
                    }
                </div>
                <div>
                    <p className="text-fg font-bold text-xl">
                        {result.failed === 0 ? 'Import complete' : 'Partial import'}
                    </p>
                    <p className="text-fg-muted text-sm mt-0.5">
                        {result.succeeded} succeeded · {result.failed} failed
                    </p>
                </div>
            </div>

            {/* Successes */}
            {successes.length > 0 && (
                <div className="space-y-2">
                    <p className="text-success text-xs font-semibold uppercase tracking-wider">Imported items</p>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {successes.map((r) => {
                            const name = submittedRows[r.row_index - 1]?.name || `Row ${r.row_index}`;
                            return (
                                <button
                                    key={r.row_index}
                                    onClick={() => r.item_id && onNavigateToItem(r.item_id)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-success/5 border border-success/10 hover:border-success/30 transition-all text-left"
                                >
                                    <CheckCircle2 size={13} className="text-success shrink-0" />
                                    <span className="text-fg text-xs flex-1 truncate">{name}</span>
                                    <span className="text-fg-subtle text-[10px] font-mono">
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
                <div className="space-y-2">
                    <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider">Failed rows</p>
                    <div className="space-y-1">
                        {failures.map((r) => (
                            <div key={r.row_index} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                                <XCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-fg-muted text-xs">Row {r.row_index}</span>
                                    <span className="text-rose-400 text-xs ml-2">{r.reason}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                <button onClick={onGoToItems} className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg px-5 py-2.5 rounded-lg font-semibold text-sm transition-all">
                    <Package size={16} />
                    Go to Items
                </button>
                <button onClick={onReset} className="flex items-center gap-2 text-fg-muted hover:text-fg border border-line-strong hover:border-line-strong px-4 py-2.5 rounded-lg text-sm transition-all">
                    <RotateCcw size={15} />
                    Start new import
                </button>
            </div>
        </div>
    );
};

export default ImportResultStep;
