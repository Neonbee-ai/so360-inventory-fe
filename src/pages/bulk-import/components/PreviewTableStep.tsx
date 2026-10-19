import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ImageIcon, ArrowLeft } from 'lucide-react';
import { Button, DataTable, type DataTableColumn } from '@so360/design-system';

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
    ambiguous: { label: 'Ambiguous name', className: 'text-danger' },
    duplicate_image: { label: 'Duplicate image', className: 'text-danger' },
    missing_primary: { label: 'Missing primary', className: 'text-danger' },
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
            ? 'bg-surface-raised border-danger'
            : status === 'warning'
                ? 'bg-surface-raised border-warning'
                : 'bg-surface border-line';

    const columns: DataTableColumn<ParsedRow>[] = [
        { key: 'row_index', header: '#' },
        { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-fg max-w-[150px] truncate block">{row.data.name || '—'}</span> },
        { key: 'sku', header: 'SKU', render: () => <span className="text-fg-subtle italic">Auto-generated</span> },
        { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.data.type || '—'}</span> },
        { key: 'category_name', header: 'Category', render: (row) => <span className="max-w-[100px] truncate block">{row.data.category_name || '—'}</span> },
        { key: 'price', header: 'Price', render: (row) => (row.data.price != null ? `${row.data.price}` : '—') },
        { key: 'description', header: 'Description', render: (row) => <span className="max-w-[220px] truncate block" title={row.data.description || undefined}>{row.data.description || '—'}</span> },
        { key: 'product_status', header: 'Status', render: (row) => <span className="capitalize">{row.data.product_status || '—'}</span> },
        {
            key: 'image',
            header: 'Image',
            render: (row) => row.data.image_urls?.length > 0
                ? <span className="flex items-center gap-nb-1 text-success" title={row.data.image_urls.length > 1 ? `${row.data.image_urls.length} images mapped by product name — first is primary` : 'Image mapped by product name'}>
                    <ImageIcon size={13} />
                    <span className="text-nb-caption">{row.data.image_urls.length > 1 ? `Primary + ${row.data.image_urls.length - 1} more` : 'Mapped'}</span>
                </span>
                : row.image_status && IMAGE_STATUS_LABEL[row.image_status]
                    ? <span className={`text-nb-caption ${IMAGE_STATUS_LABEL[row.image_status].className}`}>{IMAGE_STATUS_LABEL[row.image_status].label}</span>
                    : <span className="text-fg-subtle">—</span>,
        },
        {
            key: 'issues',
            header: 'Issues',
            render: (row) => (
                <div className="max-w-[200px]">
                    {row.errors.map((e, i) => <span key={`e${i}`} className="block text-danger">{e}</span>)}
                    {row.warnings.map((w, i) => <span key={`w${i}`} className="block text-warning">{w}</span>)}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-nb-4">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-nb-3 text-nb-caption">
                <span className="flex items-center gap-nb-1 text-success">
                    <CheckCircle2 size={14} />
                    {validRows.length} valid
                    {withImage.length > 0 && <span className="text-success">({withImage.length} with image)</span>}
                </span>
                {errorRows.length > 0 && (
                    <span className="flex items-center gap-nb-1 text-danger">
                        <AlertCircle size={14} />
                        {errorRows.length} error{errorRows.length !== 1 ? 's' : ''}
                    </span>
                )}
                {toggleLabel && (
                    <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setShowErrors(v => !v)}>
                        {toggleLabel}
                    </Button>
                )}
            </div>

            {/* Table */}
            <DataTable<ParsedRow>
                data-testid="import-preview-table"
                rows={display}
                rowKey={(row) => String(row.row_index)}
                columns={columns}
                getRowProps={(row) => ({ className: rowColor(row.status) })}
            />

            {/* Actions */}
            <div className="flex items-center gap-nb-3 pt-nb-2">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft size={15} />
                    Back
                </Button>
                <Button
                    variant="primary"
                    onClick={() => onConfirm(validRows.map(r => r.data))}
                    disabled={validRows.length === 0}
                >
                    Import {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
                </Button>
                {errorRows.length > 0 && validRows.length > 0 && (
                    <span className="text-fg-subtle text-nb-caption">{errorRows.length} error row{errorRows.length !== 1 ? 's' : ''} will be skipped</span>
                )}
            </div>
        </div>
    );
};

export default PreviewTableStep;
