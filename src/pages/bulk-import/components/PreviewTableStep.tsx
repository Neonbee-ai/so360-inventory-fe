import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ImageIcon, ArrowLeft } from 'lucide-react';

interface ParsedRow {
    row_index: number;
    status: 'valid' | 'error' | 'warning';
    errors: string[];
    warnings: string[];
    data: Record<string, any>;
}

interface Props {
    rows: ParsedRow[];
    onConfirm: (validRows: any[]) => void;
    onBack: () => void;
}

const PreviewTableStep: React.FC<Props> = ({ rows, onConfirm, onBack }) => {
    const [showErrors, setShowErrors] = useState(false);

    const validRows = rows.filter(r => r.status !== 'error');
    const errorRows = rows.filter(r => r.status === 'error');
    const withImage = validRows.filter(r => r.data.image_urls?.length > 0);

    const display = showErrors ? errorRows : rows;

    const rowColor = (status: string) =>
        status === 'error'
            ? 'bg-rose-500/5 border-rose-500/10'
            : status === 'warning'
                ? 'bg-amber-500/5 border-amber-500/10'
                : 'bg-emerald-500/5 border-emerald-500/10';

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 size={14} />
                    {validRows.length} valid
                    {withImage.length > 0 && <span className="text-emerald-500/60">({withImage.length} with image)</span>}
                </span>
                {errorRows.length > 0 && (
                    <span className="flex items-center gap-1.5 text-rose-400">
                        <AlertCircle size={14} />
                        {errorRows.length} error{errorRows.length !== 1 ? 's' : ''}
                    </span>
                )}
                <button
                    onClick={() => setShowErrors(v => !v)}
                    className="ml-auto text-slate-500 hover:text-slate-300 text-xs underline transition-colors"
                >
                    {showErrors ? 'Show all rows' : errorRows.length > 0 ? 'Show errors only' : ''}
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60">
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">#</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Name</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">SKU</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Type</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Category</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Price</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Status</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Image</th>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Issues</th>
                        </tr>
                    </thead>
                    <tbody>
                        {display.map((row) => (
                            <tr key={row.row_index} className={`border-b border-slate-800/50 ${rowColor(row.status)}`}>
                                <td className="px-3 py-2 text-slate-500">{row.row_index}</td>
                                <td className="px-3 py-2 text-slate-200 font-medium max-w-[150px] truncate">{row.data.name || '—'}</td>
                                <td className="px-3 py-2 font-mono text-slate-400">{row.data.sku || '—'}</td>
                                <td className="px-3 py-2 text-slate-400 capitalize">{row.data.type || '—'}</td>
                                <td className="px-3 py-2 text-slate-400 max-w-[100px] truncate">{row.data.category_name || '—'}</td>
                                <td className="px-3 py-2 text-slate-400">{row.data.price != null ? `${row.data.price}` : '—'}</td>
                                <td className="px-3 py-2 capitalize text-slate-400">{row.data.product_status || '—'}</td>
                                <td className="px-3 py-2">
                                    {row.data.image_urls?.length > 0
                                        ? <ImageIcon size={13} className="text-emerald-400" />
                                        : <span className="text-slate-700">—</span>
                                    }
                                </td>
                                <td className="px-3 py-2 max-w-[200px]">
                                    {row.errors.map((e, i) => (
                                        <span key={i} className="block text-rose-400">{e}</span>
                                    ))}
                                    {row.warnings.map((w, i) => (
                                        <span key={i} className="block text-amber-400">{w}</span>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    <ArrowLeft size={15} />
                    Back
                </button>
                <button
                    onClick={() => onConfirm(validRows.map(r => r.data))}
                    disabled={validRows.length === 0}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                >
                    Import {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
                </button>
                {errorRows.length > 0 && validRows.length > 0 && (
                    <span className="text-slate-500 text-xs">{errorRows.length} error row{errorRows.length !== 1 ? 's' : ''} will be skipped</span>
                )}
            </div>
        </div>
    );
};

export default PreviewTableStep;
