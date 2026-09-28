/**
 * Auto-fit storefront images in the browser before upload.
 *
 * The storefront must load in under 3 s with visually lossless images, so each
 * upload spot stores a capped original sized for where it shows:
 *
 * | Slot            | Stored size | Ratio | Cap    |
 * |-----------------|-------------|-------|--------|
 * | product         | 2000×2000   | 1:1   | 1 MB   |  (Item → Media, bulk import)
 * | categoryBanner  | 2400×750    | 16:5  | 800 KB |
 * | categoryImage   | 1600×1600   | 1:1   | 600 KB |
 * | categoryIcon    | 800×800     | 1:1   | 300 KB |
 *
 * Rules (fitImageFile):
 *  - SVG is never touched.
 *  - Within the cap and longest edge ≤ the slot's longest edge → original bytes.
 *  - Otherwise: resize so the longest edge = the slot's longest edge (never
 *    upscale, aspect kept, never cropped), encode WebP q 0.90; while over the
 *    cap step quality down by 0.02 to a floor of 0.85; still over → shrink the
 *    dimensions in 10% steps (down to the slot's minEdge) at 0.85.
 *  - Browsers that cannot encode WebP (older Safari: toBlob hands back PNG) fall
 *    back to JPEG at the same quality — except a transparent image, which stays
 *    PNG (resized only) so its alpha survives.
 *  - Always returns a real File named after the original with the right
 *    extension: FormData.append with a Blob sends filename "blob", the backend's
 *    path.extname then returns "" and rejects it as an invalid type.
 */
import { measureImageFile } from './imageDimensions';

export type ImageSlotKey = 'product' | 'categoryBanner' | 'categoryImage' | 'categoryIcon';

export interface ImageFitSlot {
    key: ImageSlotKey;
    /** Shape shown in the chip, e.g. "1:1", "16:5". */
    ratioLabel: string;
    width: number;
    height: number;
    maxBytes: number;
    /** Dimension step-down stops at this longest edge. */
    minEdge: number;
    /** Where it shows on the store (ⓘ popover). */
    where: string;
    /** What gets cropped or padded (ⓘ popover). */
    cropNote: string;
}

const KB = 1024;
const MB = 1024 * 1024;

export const IMAGE_FIT_SLOTS: Record<ImageSlotKey, ImageFitSlot> = {
    product: {
        key: 'product',
        ratioLabel: '1:1',
        width: 2000,
        height: 2000,
        maxBytes: 1 * MB,
        minEdge: 1200,
        where: 'Product cards, the product page gallery and zoom on your store.',
        cropNote: 'Shown in a square frame. Other shapes are fitted with padding, not cropped. Keep the product centred on a plain background.',
    },
    categoryBanner: {
        key: 'categoryBanner',
        ratioLabel: '16:5',
        width: 2400,
        height: 750,
        maxBytes: 800 * KB,
        minEdge: 1600,
        where: 'The wide strip at the top of the category page.',
        cropNote: 'Fills a 16:5 strip. Taller images are cropped top and bottom, so keep text and faces in the middle band.',
    },
    categoryImage: {
        key: 'categoryImage',
        ratioLabel: '1:1',
        width: 1600,
        height: 1600,
        maxBytes: 600 * KB,
        minEdge: 1000,
        where: 'Category tiles on the home page and in category grids.',
        cropNote: 'Shown in a square. The edges of wider or taller images are cropped.',
    },
    categoryIcon: {
        key: 'categoryIcon',
        ratioLabel: '1:1',
        width: 800,
        height: 800,
        maxBytes: 300 * KB,
        minEdge: 400,
        where: 'The small icon next to the category name in menus and category strips. Some themes also use it as the tile when no category image is set.',
        cropNote: 'Shown in a square or circle. Corners of non-square images are cropped.',
    },
};

export const START_QUALITY = 0.9;
export const QUALITY_STEP = 0.02;
export const QUALITY_FLOOR = 0.85;
export const DIMENSION_STEP = 0.9;

export interface ImageFitResult {
    file: File;
    /** False when the original bytes are uploaded untouched. */
    changed: boolean;
    originalName: string;
    originalBytes: number;
    finalBytes: number;
    /** Final pixel size, when known. */
    width?: number;
    height?: number;
    /** True when the pixel size was reduced. */
    resized: boolean;
    /** True when the result is still over the slot cap after every step. */
    overCap: boolean;
}

const EXT_BY_TYPE: Record<string, string> = {
    'image/png': '.png',
    'image/webp': '.webp',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/svg+xml': '.svg',
};

export const fileNameForType = (originalName: string, type: string): string => {
    const base = originalName.replace(/\.[^/.]+$/, '') || 'image';
    return `${base}${EXT_BY_TYPE[type] ?? '.jpg'}`;
};

export const formatBytes = (bytes: number): string =>
    bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / KB))} KB`;

/** Chip text, e.g. "1:1 · 2000×2000 · ≤1 MB". */
export const slotSpecLabel = (slot: ImageFitSlot): string =>
    `${slot.ratioLabel} · ${slot.width}×${slot.height} · ≤${slot.maxBytes >= MB ? `${slot.maxBytes / MB} MB` : `${slot.maxBytes / KB} KB`}`;

/** Merchant-facing summary, e.g. "photo.jpg: 6.1 MB → 640 KB (resized to 2000×2000)". */
export const describeFit = (r: ImageFitResult): string => `${r.originalName}: ${describeFitChange(r)}`;

/** Same, without the file name — for per-file rows ("6.1 MB → 640 KB (resized to 2000×2000)"). */
export const describeFitChange = (r: ImageFitResult): string => {
    if (!r.changed) return `${formatBytes(r.originalBytes)} — uploaded as-is`;
    const dims = r.width && r.height ? `${r.width}×${r.height}` : '';
    const how = r.resized && dims ? `resized to ${dims}` : 'optimised, same size';
    return `${formatBytes(r.originalBytes)} → ${formatBytes(r.finalBytes)} (${how})`;
};

// ─── Canvas helpers ────────────────────────────────────────────────────────

interface Decoded {
    source: CanvasImageSource;
    width: number;
    height: number;
    release: () => void;
}

const decode = async (file: Blob): Promise<Decoded | null> => {
    if (typeof createImageBitmap === 'function') {
        try {
            const bmp = await createImageBitmap(file);
            if (bmp.width > 0 && bmp.height > 0) {
                return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
            }
        } catch {
            // Fall through to <img>.
        }
    }
    if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return null;
    }
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement | null>(resolve => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => resolve(null);
            el.src = url;
        });
        if (!img || !img.naturalWidth || !img.naturalHeight) return null;
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => undefined };
    } finally {
        URL.revokeObjectURL(url);
    }
};

const draw = (d: Decoded, width: number, height: number): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(d.source, 0, 0, width, height);
    return canvas;
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> =>
    new Promise(resolve => canvas.toBlob(b => resolve(b), type, quality));

/** Any pixel with alpha < 255 (sampled on the resized canvas). */
const hasTransparency = (canvas: HTMLCanvasElement): boolean => {
    try {
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
        const data = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!data) return false;
        for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
        return false;
    } catch {
        return false;
    }
};

const scaledSize = (w: number, h: number, edge: number) => {
    const s = Math.min(1, edge / Math.max(w, h));
    return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
};

/** Next quality below q, clamped to the floor (0.90 → 0.88 → 0.86 → 0.85). */
const nextQuality = (q: number): number => Math.max(QUALITY_FLOOR, Math.round((q - QUALITY_STEP) * 100) / 100);

// ─── Public API ────────────────────────────────────────────────────────────

const untouched = (file: File, size?: { width: number; height: number } | null): ImageFitResult => ({
    file,
    changed: false,
    originalName: file.name,
    originalBytes: file.size,
    finalBytes: file.size,
    width: size?.width,
    height: size?.height,
    resized: false,
    overCap: false,
});

export const fitImageFile = async (file: File, slot: ImageFitSlot): Promise<ImageFitResult> => {
    if (file.type === 'image/svg+xml') return untouched(file);

    const slotEdge = Math.max(slot.width, slot.height);
    const measured = await measureImageFile(file);
    if (file.size <= slot.maxBytes && (!measured || Math.max(measured.width, measured.height) <= slotEdge)) {
        return untouched(file, measured);
    }

    const decoded = await decode(file);
    if (!decoded) {
        // Cannot decode here (no canvas support) — let the caller's hard limit decide.
        return { ...untouched(file, measured), overCap: file.size > slot.maxBytes };
    }

    try {
        const srcEdge = Math.max(decoded.width, decoded.height);
        let edge = Math.min(slotEdge, srcEdge);
        const minEdge = Math.min(slot.minEdge, edge);

        let quality = START_QUALITY;
        // Cast (not an annotation) so TS does not narrow it to null — encode() sets it.
        let format = null as 'webp' | 'jpeg' | 'png' | null;
        let best: { blob: Blob; width: number; height: number } | null = null;

        const encode = async (): Promise<{ blob: Blob; width: number; height: number } | null> => {
            const { width, height } = scaledSize(decoded.width, decoded.height, edge);
            const canvas = draw(decoded, width, height);
            if (!canvas) return null;
            if (format === null) {
                const webp = await toBlob(canvas, 'image/webp', quality);
                if (webp && webp.type === 'image/webp') {
                    format = 'webp';
                    return { blob: webp, width, height };
                }
                // No WebP encoder (Safari hands back PNG). Keep alpha as PNG, else JPEG.
                format = hasTransparency(canvas) ? 'png' : 'jpeg';
            }
            const blob = format === 'png'
                ? await toBlob(canvas, 'image/png')
                : await toBlob(canvas, `image/${format}`, quality);
            return blob ? { blob, width, height } : null;
        };

        best = await encode();
        if (!best) return { ...untouched(file, measured), overCap: file.size > slot.maxBytes };

        // PNG ignores quality — skip straight to the dimension steps.
        while (best.blob.size > slot.maxBytes && format !== 'png' && quality > QUALITY_FLOOR) {
            quality = nextQuality(quality);
            best = (await encode()) ?? best;
        }
        while (best.blob.size > slot.maxBytes && edge > minEdge) {
            edge = Math.max(minEdge, Math.round(edge * DIMENSION_STEP));
            best = (await encode()) ?? best;
        }

        const resized = best.width !== decoded.width || best.height !== decoded.height;
        // Same pixel size and no smaller than the original: keep the original bytes.
        if (!resized && best.blob.size >= file.size) return { ...untouched(file, measured), overCap: file.size > slot.maxBytes };

        const type = best.blob.type || `image/${format}`;
        const out = new File([best.blob], fileNameForType(file.name, type), { type });
        return {
            file: out,
            changed: true,
            originalName: file.name,
            originalBytes: file.size,
            finalBytes: out.size,
            width: best.width,
            height: best.height,
            resized,
            overCap: out.size > slot.maxBytes,
        };
    } finally {
        decoded.release();
    }
};
