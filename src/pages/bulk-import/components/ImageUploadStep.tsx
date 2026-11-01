import React, { useRef, useState } from 'react';
import { Image, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Alert, Badge, Button, Spinner } from '@so360/design-system';
import { fitImageFile, describeFitChange, IMAGE_FIT_SLOTS } from '../../../utils/imageFit';
import ImageSpecChip from '../../../components/media/ImageSpecChip';
import { importableRowKeyCounts, planImages, type ImageMatch } from '../nameKey';

interface UploadedImage { filename: string; name_key: string; cdn_url: string; }
interface FailedImage { filename: string; reason: string; }

interface Props {
    parsedRows: any[];
    onImagesUploaded: (uploaded: UploadedImage[]) => void;
    onUpload: (files: File[]) => Promise<{ uploaded: UploadedImage[]; failed: FailedImage[] }>;
    onSkip: () => void;
}

/** Bulk image endpoint's hard per-file limit (so360-inventory-be bulk-import controller). */
export const BULK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PRODUCT_SLOT = IMAGE_FIT_SLOTS.product;

const MATCH_BADGE: Record<ImageMatch, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
    matched: { label: 'MATCHED', tone: 'success' },
    no_match: { label: 'NO MATCH', tone: 'warning' },
    ambiguous: { label: 'AMBIGUOUS', tone: 'danger' },
    duplicate_image: { label: 'DUPLICATE IMAGE', tone: 'danger' },
    missing_primary: { label: 'MISSING PRIMARY', tone: 'danger' },
};
const MATCH_HINT: Record<ImageMatch, string> = {
    matched: 'Maps to the product with this name',
    no_match: 'No product in the CSV has this name',
    ambiguous: 'More than one product in the CSV has this name — it will not be mapped',
    duplicate_image: 'More than one image has this name and number — it will not be mapped',
    missing_primary: 'Numbered images need a primary image named exactly like the product — it will not be mapped',
};

const ImageUploadStep: React.FC<Props> = ({ parsedRows, onImagesUploaded, onUpload, onSkip }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<'idle' | 'optimising' | 'uploading' | 'done'>('idle');
    /** Per original filename: what auto-fit did ("6.1 MB → 640 KB (resized to 2000×2000)"). */
    const [fitNotes, setFitNotes] = useState<Record<string, string>>({});
    const [uploaded, setUploaded] = useState<UploadedImage[]>([]);
    const [failed, setFailed] = useState<FailedImage[]>([]);
    const [dragging, setDragging] = useState(false);

    const rowKeyCounts = importableRowKeyCounts(parsedRows);
    const plan = planImages(files.map(f => f.name), rowKeyCounts);
    const entryOf = (f: File) => plan.entries.find(e => e.filename === f.name);
    const matchOf = (f: File): ImageMatch => entryOf(f)!.match;

    const addFiles = (incoming: FileList | null) => {
        if (!incoming) return;
        setFiles(prev => {
            const existing = new Set(prev.map(f => f.name));
            return [...prev, ...Array.from(incoming).filter(f => !existing.has(f.name))];
        });
    };

    const doUpload = async () => {
        setStatus('optimising');
        // Auto-fit each photo to the product slot (2000 px, ≤1 MB) before upload.
        // The fitted file may be renamed (photo.jpg → photo.webp); the name match
        // ignores the extension, and results are mapped back to the original name.
        const originalByName = new Map<string, string>();
        const toSend: File[] = [];
        const notes: Record<string, string> = {};
        const localFailed: FailedImage[] = [];
        for (const f of files) {
            let out = f;
            try {
                const fit = await fitImageFile(f, PRODUCT_SLOT);
                out = fit.file;
                notes[f.name] = describeFitChange(fit);
            } catch {
                out = f;
            }
            if (out.size > BULK_IMAGE_MAX_BYTES) {
                localFailed.push({ filename: f.name, reason: 'Too large (max 5 MB)' });
                continue;
            }
            originalByName.set(out.name, f.name);
            toSend.push(out);
        }
        setFitNotes(notes);
        setStatus('uploading');
        const toOriginal = <T extends { filename: string }>(e: T): T => ({ ...e, filename: originalByName.get(e.filename) ?? e.filename });
        try {
            const result = toSend.length > 0 ? await onUpload(toSend) : { uploaded: [], failed: [] };
            const up = result.uploaded.map(toOriginal);
            setUploaded(up);
            setFailed([...localFailed, ...result.failed.map(toOriginal)]);
            setStatus('done');
            onImagesUploaded(up);
        } catch (err: any) {
            const reason = err?.message || 'Upload failed';
            setFailed([...localFailed, ...toSend.map(f => ({ filename: originalByName.get(f.name) ?? f.name, reason }))]);
            setStatus('done');
        }
    };

    // With no importable CSV rows nothing can match, whatever the files are
    // called — say so instead of showing every file as NO MATCH.
    const importableCount = parsedRows.filter(r => r.status !== 'error').length;
    const errorCount = parsedRows.length - importableCount;
    const matchedCount = files.filter(f => matchOf(f) === 'matched').length;
    const attentionCount = files.length - matchedCount;

    return (
        <div className="max-w-2xl mx-auto space-y-nb-6">
            <div className="flex flex-wrap items-center gap-nb-2">
                <span className="text-nb-caption font-medium text-fg-muted">Product photos</span>
                <ImageSpecChip slot={PRODUCT_SLOT} acceptedTypes="JPG, PNG, WebP" />
            </div>
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-nb-lg p-nb-8 flex flex-col items-center gap-nb-4 cursor-pointer transition-all ${
                    dragging ? 'border-primary bg-surface-raised' : 'border-line-strong bg-surface'
                }`}
            >
                <Image size={32} className="text-fg-subtle" />
                <div className="text-center">
                    <p className="text-fg font-semibold">Drop images here</p>
                    <p className="text-fg-subtle text-nb-caption mt-nb-1">JPG, PNG, WebP — big photos are shrunk automatically · name each file after its product (e.g. Namur Sofa.jpg, Namur Sofa_2.jpg)</p>
                </div>
                {/* comb-exception: multi-file accumulating drop zone with its own status list; Comb FileUpload would duplicate the file list. Hidden native input behind the zone. */}
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </div>

            <div data-testid="image-naming-guide" className="rounded-nb-md border border-line bg-surface px-nb-4 py-nb-3 text-nb-caption text-fg-muted space-y-nb-1">
                <p className="font-semibold text-fg-muted">How to Upload Product Images</p>
                <p>Name each image after its product — use the exact Product Name from your CSV.</p>
                <p>One image: <span className="font-mono text-primary">Chair.jpg</span></p>
                <p>Several images: <span className="font-mono text-primary">Chair.jpg</span>, <span className="font-mono text-primary">Chair_2.jpg</span>, <span className="font-mono text-primary">Chair_3.jpg</span></p>
                <p>The first image (<span className="font-mono">Chair.jpg</span>) is the primary image shown first in the store.</p>
            </div>

            {importableCount === 0 && (
                <Alert variant="error">
                    None of the {parsedRows.length} CSV row{parsedRows.length !== 1 ? 's' : ''} can be imported
                    {errorCount > 0 ? ` (${errorCount} with errors)` : ''}, so no image can be matched to a product.
                    Go back and fix the CSV first — for example, check the <span className="font-mono">name</span> column header.
                </Alert>
            )}

            {files.length > 0 && (
                <div className="space-y-nb-2">
                    <p className="text-fg-muted text-nb-caption font-semibold">
                        {files.length} file{files.length !== 1 ? 's' : ''} selected · {matchedCount} match products · {attentionCount} need attention
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-nb-1 pr-nb-1">
                        {files.map(f => {
                            const match = matchOf(f);
                            const isMatch = match === 'matched';
                            const uploadedEntry = uploaded.find(u => u.filename === f.name);
                            const failedEntry = failed.find(u => u.filename === f.name);
                            return (
                                <div key={f.name} className="flex items-center gap-nb-3 px-nb-3 py-nb-2 rounded-nb-md bg-surface border border-line">
                                    {(status === 'uploading' || status === 'optimising') && !uploadedEntry && !failedEntry && <Spinner aria-label="Uploading" />}
                                    {uploadedEntry && <CheckCircle2 size={14} className="text-success shrink-0" />}
                                    {failedEntry && <XCircle size={14} className="text-danger shrink-0" />}
                                    {status === 'idle' && (isMatch
                                        ? <CheckCircle2 size={14} className="text-success shrink-0" />
                                        : <div className="w-3.5 h-3.5 rounded-full border border-warning shrink-0" />
                                    )}
                                    <span className="text-fg-muted text-nb-caption font-mono flex-1 truncate">{f.name}</span>
                                    {isMatch && (
                                        <span data-testid="image-position" className="text-fg-subtle text-nb-caption shrink-0">{entryOf(f)!.seq === 1 ? 'Primary' : `Image ${entryOf(f)!.seq}`}</span>
                                    )}
                                    {fitNotes[f.name] && (
                                        <span data-testid="bulk-fit-note" className="text-fg-subtle text-nb-caption shrink-0">{fitNotes[f.name]}</span>
                                    )}
                                    {status === 'idle' && (
                                        <span title={MATCH_HINT[match]}>
                                            <Badge tone={MATCH_BADGE[match].tone} size="sm">{MATCH_BADGE[match].label}</Badge>
                                        </span>
                                    )}
                                    {failedEntry && <span className="text-danger text-nb-caption">{failedEntry.reason}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-nb-3">
                {status === 'idle' && (
                    <>
                        <Button variant="primary" onClick={doUpload} disabled={files.length === 0}>
                            <Image size={16} />
                            Upload {files.length > 0 ? `${files.length} image${files.length !== 1 ? 's' : ''}` : 'Images'}
                        </Button>
                        <Button variant="ghost" onClick={onSkip}>Skip images →</Button>
                    </>
                )}
                {(status === 'uploading' || status === 'optimising') && (
                    <div className="flex items-center gap-nb-2 text-fg-muted text-nb-caption">
                        <Spinner aria-label="Uploading" />
                        {status === 'optimising' ? 'Optimising photos…' : 'Uploading…'}
                    </div>
                )}
                {status === 'done' && (
                    <Button variant="primary" onClick={onSkip}>
                        Next: Preview <ArrowRight size={16} />
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ImageUploadStep;
