import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
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
        <div className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
            {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                    <Loader2 size={20} className="text-blue-400 animate-spin" />
                </div>
            ) : error ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <AlertCircle size={16} className="text-rose-400 mb-1" />
                    <span className="text-[10px] text-rose-400 text-center leading-tight">Failed</span>
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
                    className={`absolute bottom-0 inset-x-0 px-1 py-0.5 text-[9px] leading-tight text-center truncate ${
                        assessment.ok ? 'bg-slate-900/80 text-slate-300' : 'bg-amber-500/90 text-slate-950 font-medium'
                    }`}
                >
                    {assessment.ok ? '' : '⚠ '}{assessment.size} · {assessment.ratio}
                </div>
            )}
            <button
                type="button"
                onClick={onRemove}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-slate-300 hover:bg-rose-600 hover:text-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            >
                <X size={12} />
            </button>
        </div>
    );
};

export default ImageThumbnail;
