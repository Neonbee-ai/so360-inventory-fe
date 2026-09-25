import React, { useState, useRef, useCallback } from 'react';
import { Upload, Image } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { mediaService } from '../../services/mediaService';
import { measureImageFile, type ImageSize } from '../../utils/imageDimensions';
import ImageThumbnail from './ImageThumbnail';

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
/** Core media accepts images up to 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Masters up to this longest side are uploaded untouched. */
export const MAX_ORIGINAL_EDGE_PX = 4096;
/** Oversized masters are downscaled to this longest side — never smaller. */
export const DOWNSCALE_EDGE_PX = 2400;
const DOWNSCALE_QUALITY = 0.92;

const EXT_BY_TYPE: Record<string, string> = {
    'image/png': '.png',
    'image/webp': '.webp',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
};

/**
 * Keep the merchant's master: upload the original bytes whenever the file is
 * within 10 MB and 4096 px. Only an oversized master is re-encoded — to 2400 px
 * on the longest side at quality 0.92, same format (PNG stays PNG).
 */
export const needsDownscale = (file: File, size: ImageSize | null): boolean =>
    file.type !== 'image/svg+xml' &&
    (file.size > MAX_UPLOAD_BYTES || (size !== null && Math.max(size.width, size.height) > MAX_ORIGINAL_EDGE_PX));

const downscale = async (file: File): Promise<File> => {
    const out = await imageCompression(file, {
        // Only the >10 MB case should ever iterate; stay a little under the cap.
        maxSizeMB: 9.5,
        maxWidthOrHeight: DOWNSCALE_EDGE_PX,
        // Never shrink below 2400 px while fitting the size budget — drop quality instead.
        alwaysKeepResolution: true,
        initialQuality: DOWNSCALE_QUALITY,
        fileType: file.type,
        useWebWorker: true,
        preserveExif: false,
    });
    // imageCompression returns a Blob, not a File. FormData.append with a
    // Blob defaults the multipart filename to "blob" → backend path.extname
    // returns "" → 400 Invalid file type. Re-wrap as a real File.
    const type = out.type || file.type;
    const ext = EXT_BY_TYPE[type] ?? EXT_BY_TYPE[file.type] ?? '.jpg';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    return new File([out], `${baseName}${ext}`, { type });
};

interface UploadingFile {
    id: string;
    name: string;
    error?: string;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ imageUrls, onImagesChange, maxFiles = 10, onImageMeasured }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploading, setUploading] = useState<UploadingFile[]>([]);
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

            let size = await measureImageFile(file);
            let processedFile: File = file;

            if (needsDownscale(file, size)) {
                try {
                    processedFile = await downscale(file);
                    const measured = await measureImageFile(processedFile);
                    if (measured) {
                        size = measured;
                    } else if (size) {
                        const scale = Math.min(1, DOWNSCALE_EDGE_PX / Math.max(size.width, size.height));
                        size = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
                    }
                } catch {
                    processedFile = file; // fall back to the original if it still fits
                }
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
            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                    flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${isDragOver
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                    }
                `}
            >
                <Upload size={32} className={isDragOver ? 'text-blue-400' : 'text-slate-600'} />
                <p className="text-sm text-slate-400 mt-3">
                    {isDragOver ? 'Drop files here' : 'Drag and drop images here, or click to browse'}
                </p>
                <p className="text-xs text-slate-600 mt-1">PNG, JPG, SVG, WebP — up to 10 MB each, originals kept</p>
                <input
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

            {(imageUrls.length > 0 || uploading.length > 0) && (
                <p className="text-xs text-slate-500">
                    Best results: square photos (1:1), at least 1200×1200px, product centred on a plain background.
                    Fashion stores: portrait 3:4. Images marked ⚠ will still show, but small or blurry.
                </p>
            )}

            {imageUrls.length >= maxFiles && (
                <p className="text-xs text-amber-400">Maximum {maxFiles} images reached</p>
            )}
        </div>
    );
};

export default MediaUploader;
