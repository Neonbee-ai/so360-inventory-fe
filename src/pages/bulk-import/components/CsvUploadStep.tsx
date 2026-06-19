import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface Props {
    onParsed: (result: any) => void;
    onParse: (file: File) => Promise<any>;
}

const CsvUploadStep: React.FC<Props> = ({ onParsed, onParse }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
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

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handle(file);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all ${
                    dragging
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-slate-700 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'
                }`}
            >
                <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                    <FileText size={28} className="text-blue-400" />
                </div>
                <div className="text-center">
                    <p className="text-slate-200 font-semibold text-lg">Drop your CSV here</p>
                    <p className="text-slate-500 text-sm mt-1">or click to browse — max 2 MB</p>
                </div>
                <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
            </div>

            {loading && (
                <div className="mt-6 flex items-center gap-3 text-slate-400 text-sm">
                    <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    Parsing CSV…
                </div>
            )}

            {error && (
                <div className="mt-4 flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Required CSV columns</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {[
                        ['name', 'Item name (required)'],
                        ['sku', 'Unique SKU code'],
                        ['type', 'product / service / raw_material…'],
                        ['price', 'Selling price'],
                        ['cost', 'Cost price'],
                        ['category_name', 'Matches existing category'],
                        ['unit_name', 'Matches existing unit of measure'],
                        ['product_status', 'draft / active / archived'],
                    ].map(([col, desc]) => (
                        <div key={col} className="flex gap-2">
                            <span className="font-mono text-blue-400 text-xs mt-0.5">{col}</span>
                            <span className="text-slate-500 text-xs">{desc}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <Upload size={13} className="text-slate-500" />
                    <a
                        href="data:text/csv;charset=utf-8,name,sku,type,price,cost,category_name,unit_name,is_batch_tracked,is_serial_tracked,is_online_visible,product_status,barcode,brand,weight,weight_unit"
                        download="bulk-import-template.csv"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                        Download CSV template
                    </a>
                </div>
            </div>
        </div>
    );
};

export default CsvUploadStep;
