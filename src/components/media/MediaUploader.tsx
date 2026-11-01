import React, { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Alert } from '@so360/design-system';
import { mediaService } from '../../services/mediaService';
import { fitImageFile, describeFit, IMAGE_FIT_SLOTS } from '../../utils/imageFit';
import ImageThumbnail from './ImageThumbnail';
import ImageSpecChip from './ImageSpecChip';

interface MediaUploaderProps {
    imageUrls: string[];
    onImagesChange: (urls: string[]) => void;
    maxFiles?: number;
    /**
     * Natural size of a photo, reported once per url — right after upload for
     * new photos, and when a thumbnail loads for previously saved ones. Feeds
     * items.image_meta.
     */
    onImageMeasured?: (url: string, width: number, height: number) => void;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
/** Core media's hard limit. Photos are auto-fitted to the 1 MB product cap first. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PRODUCT_SLOT = IMAGE_FIT_SLOTS.product;

interface UploadingFile {
    id: string;
    name: string;
    error?: string;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ imageUrls, onImagesChange, maxFiles = 10, onImageMeasured }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploading, setUploading] = useState<UploadingFile[]>([]);
    /** What auto-fit did to each file of the latest drop — never silent. */
    const [notes, setNotes] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArr = Array.from(files);
        const remaining = maxFiles - imageUrls.length;
        if (remaining <= 0) return;

        const toUpload = fileArr.slice(0, remaining);
        const tempIds: UploadingFile[] = toUpload.map((f, i) => ({
            id: `upload-${Date.now()}-${i}`,
            name: f.name,
        }));

        setUploading(prev => [...prev, ...tempIds]);
        setNotes([]);

        // Several files in one drop: append to the running list, not the
        // imageUrls captured when the drop started, or only the last one sticks.
        let currentUrls = imageUrls;

        for (let i = 0; i < toUpload.length; i++) {
            const file = toUpload[i];
            const tempId = tempIds[i].id;
            const fail = (error: string) =>
                setUploading(prev => prev.map(u => u.id === tempId ? { ...u, error } : u));

            if (!ALLOWED_TYPES.includes(file.type)) {
                fail('Invalid type');
                continue;
            }

            // Auto-fit to the product slot (2000 px, ≤1 MB); SVG and small photos go up untouched.
            let processedFile: File = file;
            let size: { width: number; height: number } | null = null;
            try {
                const fit = await fitImageFile(file, PRODUCT_SLOT);
                processedFile = fit.file;
                size = fit.width && fit.height ? { width: fit.width, height: fit.height } : null;
                setNotes(prev => [...prev, describeFit(fit)]);
            } catch {
                processedFile = file; // fall back to the original if it still fits
            }

            if (processedFile.size > MAX_UPLOAD_BYTES) {
                fail('Too large (max 10 MB)');
                continue;
            }

            try {
                const result = await mediaService.uploadFile(processedFile);
                currentUrls = [...currentUrls, result.url];
                onImagesChange(currentUrls);
                if (size && onImageMeasured) onImageMeasured(result.url, size.width, size.height);
                setUploading(prev => prev.filter(u => u.id !== tempId));
            } catch (err: any) {
                fail(err.message || 'Upload failed');
            }
        }
    }, [imageUrls, maxFiles, onImagesChange, onImageMeasured]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const removeImage = (index: number) => {
        onImagesChange(imageUrls.filter((_, i) => i !== index));
    };

    const removeUploadError = (id: string) => {
        setUploading(prev => prev.filter(u => u.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-fg-muted">Product photos</span>
                <ImageSpecChip slot={PRODUCT_SLOT} />
            </div>

            {/* comb-exception: no DS drop-zone; hand-built drag/drop target */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                    flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${isDragOver
                        ? 'border-primary bg-primary/10'
                        : 'border-line-strong bg-surface-raised/30 hover:border-line-strong hover:bg-surface-raised/50'
                    }
                `}
            >
                <Upload size={32} className={isDragOver ? 'text-primary' : 'text-fg-subtle'} />
                <p className="text-sm text-fg-muted mt-3">
                    {isDragOver ? 'Drop files here' : 'Drag and drop images here, or click to browse'}
                </p>
                <p className="text-xs text-fg-subtle mt-1">PNG, JPG, SVG, WebP — large photos are shrunk automatically</p>
                {/* comb-exception: hidden native file input driven by the drop zone (no DS file-picker trigger) */}
                <input // comb-exception: hidden native file input driven by the drop zone
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    multiple
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                    className="hidden"
                />
            </div>

            {/* Thumbnails */}
            {(imageUrls.length > 0 || uploading.length > 0) && (
                <div className="flex flex-wrap gap-3">
                    {imageUrls.map((url, i) => (
                        <ImageThumbnail
                            key={url + i}
                            url={url}
                            onRemove={() => removeImage(i)}
                            onMeasured={onImageMeasured}
                        />
                    ))}
                    {uploading.map(u => (
                        <ImageThumbnail
                            key={u.id}
                            url=""
                            isLoading={!u.error}
                            error={u.error}
                            onRemove={() => removeUploadError(u.id)}
                        />
                    ))}
                </div>
            )}

            {notes.length > 0 && (
                <ul data-testid="image-fit-notes" className="space-y-0.5 text-xs text-fg-subtle">
                    {notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
            )}

            {imageUrls.length >= maxFiles && (
                <Alert variant="warning">Maximum {maxFiles} images reached</Alert>
            )}
        </div>
    );
};

export default MediaUploader;
