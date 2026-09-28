import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { slotSpecLabel, type ImageFitSlot } from '../../utils/imageFit';

interface ImageSpecChipProps {
    slot: ImageFitSlot;
    /** Accepted types shown in the explanation. */
    acceptedTypes?: string;
    className?: string;
}

/**
 * Always-visible spec chip for an upload spot ("1:1 · 2000×2000 · ≤1 MB") plus
 * an ⓘ button that toggles a short explanation. Click/tap toggles (works on
 * touch), Escape or a tap outside closes, the button is keyboard focusable and
 * described by the explanation.
 */
const ImageSpecChip: React.FC<ImageSpecChipProps> = ({ slot, acceptedTypes = 'PNG, JPG, WebP, SVG', className = '' }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLSpanElement>(null);
    const popoverId = useId();
    const cap = slotSpecLabel(slot).split(' · ')[2];

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent | TouchEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('touchstart', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('touchstart', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <span ref={rootRef} className={`relative inline-flex items-center gap-1 align-middle ${className}`}>
            <span
                data-testid="image-spec-chip"
                className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 whitespace-nowrap"
            >
                {slotSpecLabel(slot)}
            </span>
            <button
                type="button"
                aria-label="About this image size"
                aria-expanded={open}
                aria-controls={popoverId}
                aria-describedby={popoverId}
                onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
                <Info size={13} />
            </button>
            <span
                id={popoverId}
                role="tooltip"
                hidden={!open}
                onClick={e => e.stopPropagation()}
                className={`absolute left-0 top-full z-30 mt-1 ${open ? 'block' : 'hidden'} w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-[11px] font-normal leading-snug text-slate-300 shadow-xl`}
            >
                <span className="block">{slot.where}</span>
                <span className="mt-1 block">{slot.cropNote}</span>
                <span className="mt-1 block">
                    Best at {slot.width}×{slot.height}. Bigger files are shrunk automatically to {cap} with no visible quality loss.
                </span>
                <span className="mt-1 block text-slate-500">Accepted: {acceptedTypes}</span>
            </span>
        </span>
    );
};

export default ImageSpecChip;
