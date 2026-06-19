import React, { useRef, useState } from 'react';
import { Image, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

interface UploadedImage { filename: string; sku: string; cdn_url: string; }
interface FailedImage { filename: string; reason: string; }

interface Props {
    parsedRows: any[];
    onImagesUploaded: (uploaded: UploadedImage[]) => void;
    onUpload: (files: File[]) => Promise<{ uploaded: UploadedImage[]; failed: FailedImage[] }>;
    onSkip: () => void;
}

function slugify(s: string): string {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function slugifyFilename(name: string): string {
    return slugify(name.replace(/\.[^.]+$/, ''));
}

const ImageUploadStep: React.FC<Props> = ({ parsedRows, onImagesUploaded, onUpload, onSkip }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
    const [uploaded, setUploaded] = useState<UploadedImage[]>([]);
    const [failed, setFailed] = useState<FailedImage[]>([]);
    const [dragging, setDragging] = useState(false);

    const validSkus = new Set(
        parsedRows.filter(r => r.status !== 'error').map(r => slugify(r.data.sku || ''))
    );

    const addFiles = (incoming: FileList | null) => {
        if (!incoming) return;
        setFiles(prev => {
            const existing = new Set(prev.map(f => f.name));
            return [...prev, ...Array.from(incoming).filter(f => !existing.has(f.name))];
        });
    };

    const doUpload = async () => {
        setStatus('uploading');
        const result = await onUpload(files);
        setUploaded(result.uploaded);
        setFailed(result.failed);
        setStatus('done');
        onImagesUploaded(result.uploaded);
    };

    const matched = files.filter(f => validSkus.has(slugifyFilename(f.name)));
    const unmatched = files.filter(f => !validSkus.has(slugifyFilename(f.name)));

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all ${
                    dragging ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                }`}
            >
                <Image size={32} className="text-slate-500" />
                <div className="text-center">
                    <p className="text-slate-200 font-semibold">Drop images here</p>
                    <p className="text-slate-500 text-sm mt-1">JPG, PNG — max 5 MB each · name files to match SKU (e.g. WA-001.jpg)</p>
                </div>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </div>

            {files.length > 0 && (
                <div className="space-y-2">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        {files.length} file{files.length !== 1 ? 's' : ''} selected · {matched.length} match SKUs · {unmatched.length} no match
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {files.map(f => {
                            const isMatch = validSkus.has(slugifyFilename(f.name));
                            const uploadedEntry = uploaded.find(u => u.filename === f.name);
                            const failedEntry = failed.find(u => u.filename === f.name);
                            return (
                                <div key={f.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
                                    {status === 'uploading' && !uploadedEntry && !failedEntry && <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />}
                                    {uploadedEntry && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                                    {failedEntry && <XCircle size={14} className="text-rose-400 shrink-0" />}
                                    {status === 'idle' && (isMatch
                                        ? <CheckCircle2 size={14} className="text-emerald-500/60 shrink-0" />
                                        : <div className="w-3.5 h-3.5 rounded-full border border-amber-500/50 shrink-0" />
                                    )}
                                    <span className="text-slate-300 text-xs font-mono flex-1 truncate">{f.name}</span>
                                    {status === 'idle' && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                            isMatch
                                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                        }`}>{isMatch ? 'MATCHED' : 'NO MATCH'}</span>
                                    )}
                                    {failedEntry && <span className="text-rose-400 text-[10px]">{failedEntry.reason}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3">
                {status === 'idle' && (
                    <>
                        <button
                            onClick={doUpload}
                            disabled={files.length === 0}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                        >
                            <Image size={16} />
                            Upload {files.length > 0 ? `${files.length} image${files.length !== 1 ? 's' : ''}` : 'Images'}
                        </button>
                        <button onClick={onSkip} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                            Skip images →
                        </button>
                    </>
                )}
                {status === 'uploading' && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Uploading…
                    </div>
                )}
                {status === 'done' && (
                    <button onClick={onSkip} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all">
                        Next: Preview <ArrowRight size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ImageUploadStep;
