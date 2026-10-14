import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ImageIcon, ArrowLeft } from 'lucide-react';

interface ParsedRow {
    row_index: number;
    status: 'valid' | 'error' | 'warning';
    errors: string[];
    warnings: string[];
    data: Record<string, any>;
    /** Set after the image step: how this row's image was (not) mapped. */
    image_status?: 'mapped' | 'not_found' | 'ambiguous' | 'duplicate_image' | 'missing_primary';
}

const IMAGE_STATUS_LABEL: Record<string, { label: string; className: string }> = {
    not_found: { label: 'Not found', className: 'text-warning' },
    ambiguous: { label: 'Ambiguous name', className: 'text-rose-400' },
    duplicate_image: { label: 'Duplicate image', className: 'text-rose-400' },
    missing_primary: { label: 'Missing primary', className: 'text-rose-400' },
};

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
                ? 'bg-warning/5 border-warning/10'
                : 'bg-success/5 border-success/10';

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 size={14} />
                    {validRows.length} valid
                    {withImage.length > 0 && <span className="text-success/60">({withImage.length} with image)</span>}
                </span>
                {errorRows.length > 0 && (
                    <span className="flex items-center gap-1.5 text-rose-400">
                        <AlertCircle size={14} />
                        {errorRows.length} error{errorRows.length !== 1 ? 's' : ''}
                    </span>
                )}
                <button
                    onClick={() => setShowErrors(v => !v)}
                    className="ml-auto text-fg-subtle hover:text-fg-muted text-xs underline transition-colors"
                >
                    {showErrors ? 'Show all rows' : errorRows.length > 0 ? 'Show errors only' : ''}
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-line bg-surface/60">
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">#</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Name</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">SKU</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Type</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Category</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Price</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Description</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Status</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Image</th>
                            <th className="px-3 py-2.5 text-left text-fg-subtle font-semibold">Issues</th>
                        </tr>
                    </thead>
                    <tbody>
                        {display.map((row) => (
                            <tr key={row.row_index} className={`border-b border-line/50 ${rowColor(row.status)}`}>
                                <td className="px-3 py-2 text-fg-subtle">{row.row_index}</td>
                                <td className="px-3 py-2 text-fg font-medium max-w-[150px] truncate">{row.data.name || '—'}</td>
                                <td className="px-3 py-2 text-fg-subtle italic">Auto-generated</td>
                                <td className="px-3 py-2 text-fg-muted capitalize">{row.data.type || '—'}</td>
                                <td className="px-3 py-2 text-fg-muted max-w-[100px] truncate">{row.data.category_name || '—'}</td>
                                <td className="px-3 py-2 text-fg-muted">{row.data.price != null ? `${row.data.price}` : '—'}</td>
                                <td className="px-3 py-2 text-fg-muted max-w-[220px] truncate" title={row.data.description || undefined}>{row.data.description || '—'}</td>
                                <td className="px-3 py-2 capitalize text-fg-muted">{row.data.product_status || '—'}</td>
                                <td className="px-3 py-2">
                                    {row.data.image_urls?.length > 0
                                        ? <span className="flex items-center gap-1 text-success" title={row.data.image_urls.length > 1 ? `${row.data.image_urls.length} images mapped by product name — first is primary` : 'Image mapped by product name'}>
                                            <ImageIcon size={13} />
                                            <span className="text-[10px]">{row.data.image_urls.length > 1 ? `Primary + ${row.data.image_urls.length - 1} more` : 'Mapped'}</span>
                                        </span>
                                        : row.image_status && IMAGE_STATUS_LABEL[row.image_status]
                                            ? <span className={`text-[10px] ${IMAGE_STATUS_LABEL[row.image_status].className}`}>{IMAGE_STATUS_LABEL[row.image_status].label}</span>
                                            : <span className="text-fg-subtle">—</span>
                                    }
                                </td>
                                <td className="px-3 py-2 max-w-[200px]">
                                    {row.errors.map((e, i) => (
                                        <span key={i} className="block text-rose-400">{e}</span>
                                    ))}
                                    {row.warnings.map((w, i) => (
                                        <span key={i} className="block text-warning">{w}</span>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                <button onClick={onBack} className="flex items-center gap-2 text-fg-subtle hover:text-fg-muted text-sm transition-colors">
                    <ArrowLeft size={15} />
                    Back
                </button>
                <button
                    onClick={() => onConfirm(validRows.map(r => r.data))}
                    disabled={validRows.length === 0}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-primary-fg px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                >
                    Import {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
                </button>
                {errorRows.length > 0 && validRows.length > 0 && (
                    <span className="text-fg-subtle text-xs">{errorRows.length} error row{errorRows.length !== 1 ? 's' : ''} will be skipped</span>
                )}
            </div>
        </div>
    );
};

export default PreviewTableStep;
