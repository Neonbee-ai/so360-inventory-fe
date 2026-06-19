import React from 'react';
import { CheckCircle2, XCircle, Package, RotateCcw, Loader2 } from 'lucide-react';

interface RowResult {
    row_index: number;
    status: 'success' | 'error';
    item_id?: string;
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
                <Loader2 size={36} className="text-blue-500 animate-spin" />
                <p className="text-slate-400 text-sm">Importing {submittedRows.length} items…</p>
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
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                    {result.failed === 0
                        ? <CheckCircle2 size={28} className="text-emerald-400" />
                        : <Package size={28} className="text-amber-400" />
                    }
                </div>
                <div>
                    <p className="text-slate-50 font-bold text-xl">
                        {result.failed === 0 ? 'Import complete' : 'Partial import'}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">
                        {result.succeeded} succeeded · {result.failed} failed
                    </p>
                </div>
            </div>

            {/* Successes */}
            {successes.length > 0 && (
                <div className="space-y-2">
                    <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Imported items</p>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {successes.map((r) => {
                            const name = submittedRows[r.row_index - 1]?.name || `Row ${r.row_index}`;
                            return (
                                <button
                                    key={r.row_index}
                                    onClick={() => r.item_id && onNavigateToItem(r.item_id)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all text-left"
                                >
                                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                                    <span className="text-slate-200 text-xs flex-1 truncate">{name}</span>
                                    <span className="text-slate-600 text-[10px] font-mono">{r.item_id?.slice(0, 8)}…</span>
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
                                    <span className="text-slate-400 text-xs">Row {r.row_index}</span>
                                    <span className="text-rose-400 text-xs ml-2">{r.reason}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                <button onClick={onGoToItems} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all">
                    <Package size={16} />
                    Go to Items
                </button>
                <button onClick={onReset} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-4 py-2.5 rounded-lg text-sm transition-all">
                    <RotateCcw size={15} />
                    Start new import
                </button>
            </div>
        </div>
    );
};

export default ImportResultStep;
