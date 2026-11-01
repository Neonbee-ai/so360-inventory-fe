import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { IconButton, Spinner } from '@so360/design-system';
import { assessProductImage, type ProductImageAssessment } from '../../utils/imageRatio';

interface ImageThumbnailProps {
    url: string;
    isLoading?: boolean;
    error?: string;
    onRemove: () => void;
    /** Natural size of the loaded photo (not reported for the error placeholder or 0×0 SVGs). */
    onMeasured?: (url: string, width: number, height: number) => void;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ url, isLoading, error, onRemove, onMeasured }) => {
    // Measured from the loaded image so merchants see size/shape for new and
    // previously saved photos alike. SVGs can report 0×0 — no badge then.
    const [assessment, setAssessment] = useState<ProductImageAssessment | null>(null);

    return (
        <div className="relative group w-24 h-24 rounded-nb-md overflow-hidden border border-line-strong bg-surface-raised">
            {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                    <Spinner aria-label="Uploading" />
                </div>
            ) : error ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <AlertCircle size={16} className="text-danger mb-1" />
                    <span className="text-nb-overline text-danger text-center leading-tight">Failed</span>
                </div>
            ) : (
                <img
                    src={url}
                    alt="Uploaded"
                    className="w-full h-full object-contain"
                    onLoad={e => {
                        const { naturalWidth: w, naturalHeight: h, src } = e.currentTarget;
                        // The onError fallback is an inline SVG — don't grade the placeholder.
                        const isFallback = src.startsWith('data:');
                        const measured = !isFallback && w > 0 && h > 0;
                        setAssessment(measured ? assessProductImage(w, h) : null);
                        if (measured && onMeasured) onMeasured(url, w, h);
                    }}
                    onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="%23475569"><rect width="96" height="96"/><text x="48" y="54" text-anchor="middle" fill="%2394a3b8" font-size="12">Error</text></svg>'; }}
                />
            )}
            {assessment && !isLoading && !error && (
                <div
                    data-testid="image-size-badge"
                    title={assessment.ok ? 'Good fit for store product cards' : assessment.issues.join('\n')}
                    className={`absolute bottom-0 inset-x-0 px-1 py-0.5 text-nb-overline leading-tight text-center truncate ${
                        assessment.ok ? 'bg-surface/80 text-fg-muted' : 'bg-warning/90 text-primary-fg font-medium'
                    }`}
                >
                    {assessment.ok ? '' : '⚠ '}{assessment.size} · {assessment.ratio}
                </div>
            )}
            <div className="absolute top-nb-1 right-nb-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <IconButton label="Remove image" size="sm" icon={<X size={12} />} onClick={onRemove} />
            </div>
        </div>
    );
};

export default ImageThumbnail;
