import React from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface ImageThumbnailProps {
    url: string;
    isLoading?: boolean;
    error?: string;
    onRemove: () => void;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ url, isLoading, error, onRemove }) => {
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
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="%23475569"><rect width="96" height="96"/><text x="48" y="54" text-anchor="middle" fill="%2394a3b8" font-size="12">Error</text></svg>'; }}
                />
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
