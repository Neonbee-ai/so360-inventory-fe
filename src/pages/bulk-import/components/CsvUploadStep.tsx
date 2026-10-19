import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Alert, FileUpload, Spinner } from '@so360/design-system';

interface Props {
    onParsed: (result: any) => void;
    onParse: (file: File) => Promise<any>;
}

const CsvUploadStep: React.FC<Props> = ({ onParsed, onParse }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setError('Please upload a .csv file');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const result = await onParse(file);
            onParsed(result);
        } catch (e: any) {
            setError(e.message || 'Failed to parse CSV');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <FileUpload
                name="bulk-import-csv"
                aria-label="CSV file"
                accept=".csv"
                prompt="Choose a CSV file"
                disabled={loading}
                onChange={(files) => { const f = files[0]; if (f) handle(f); }}
                onReject={() => setError('Please upload a .csv file')}
            />
            <p className="mt-nb-2 text-center text-fg-subtle text-nb-caption">max 2 MB</p>

            {loading && (
                <div className="mt-nb-6 flex items-center gap-nb-3 text-fg-muted text-nb-caption">
                    <Spinner label="Parsing" />
                    Parsing CSV…
                </div>
            )}

            {error && (
                <div className="mt-nb-4">
                    <Alert variant="error">{error}</Alert>
                </div>
            )}

            <div className="mt-nb-6 bg-surface border border-line rounded-nb-lg p-nb-4">
                <p className="text-fg-muted text-nb-caption font-semibold uppercase mb-nb-3">Required CSV columns</p>
                <div className="grid grid-cols-2 gap-x-nb-6 gap-y-nb-1 text-nb-caption">
                    {[
                        ['name', 'Item name (required)'],
                        ['type', 'product / service / raw_material…'],
                        ['price', 'Selling price'],
                        ['cost', 'Cost price'],
                        ['category_name', 'Matches existing category'],
                        ['unit_name', 'Matches existing unit of measure'],
                        ['product_status', 'draft / active / archived'],
                        ['description', 'Product description (optional)'],
                    ].map(([col, desc]) => (
                        <div key={col} className="flex gap-nb-2">
                            <span className="font-mono text-primary text-nb-caption">{col}</span>
                            <span className="text-fg-subtle text-nb-caption">{desc}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-nb-3 text-fg-subtle text-nb-caption">
                    <span className="font-semibold text-fg-muted">SKU:</span> not needed — each item gets its SKU automatically.
                    In the next step, name each image after its product (e.g. <span className="font-mono text-primary">Namur Sofa.jpg</span>); for several images add _2, _3… (<span className="font-mono text-primary">Namur Sofa_2.jpg</span>).
                </p>
                <p className="mt-nb-3 text-fg-subtle text-nb-caption">
                    <span className="font-semibold text-fg-muted">Description:</span> add the product description in the{' '}
                    <span className="font-mono text-primary">description</span> column. It will be automatically saved to the product.
                </p>
                <div className="mt-nb-4 flex items-center gap-nb-2">
                    <Upload size={13} className="text-fg-subtle" />
                    <a
                        href="data:text/csv;charset=utf-8,name,type,price,cost,category_name,unit_name,is_batch_tracked,is_serial_tracked,is_online_visible,product_status,barcode,brand,weight,weight_unit,description"
                        download="bulk-import-template.csv"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary text-nb-caption underline"
                    >
                        Download CSV template
                    </a>
                </div>
            </div>
        </div>
    );
};

export default CsvUploadStep;
