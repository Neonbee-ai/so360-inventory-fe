/**
 * Read an image file's natural width/height in the browser, before upload.
 *
 * Tries createImageBitmap (fast, off the DOM), then an <img> element. Resolves
 * null when the size cannot be read (SVG without intrinsic size, unsupported
 * format, no browser APIs as in jsdom) — callers treat that as "unknown" and
 * upload the original bytes.
 */
export interface ImageSize {
    width: number;
    height: number;
}

const MEASURE_TIMEOUT_MS = 8000;

const viaImageBitmap = async (file: Blob): Promise<ImageSize | null> => {
    if (typeof createImageBitmap !== 'function') return null;
    const bmp = await createImageBitmap(file);
    try {
        return bmp.width > 0 && bmp.height > 0 ? { width: bmp.width, height: bmp.height } : null;
    } finally {
        bmp.close?.();
    }
};

const viaImageElement = (file: Blob): Promise<ImageSize | null> =>
    new Promise(resolve => {
        if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            resolve(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        let settled = false;
        const done = (size: ImageSize | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            URL.revokeObjectURL(objectUrl);
            resolve(size);
        };
        const timer = setTimeout(() => done(null), MEASURE_TIMEOUT_MS);
        img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : null);
        img.onerror = () => done(null);
        img.src = objectUrl;
    });

export const measureImageFile = async (file: Blob): Promise<ImageSize | null> => {
    if (file.type === 'image/svg+xml') {
        // SVGs are resolution-independent — nothing to downscale or grade.
        return null;
    }
    try {
        const size = await viaImageBitmap(file);
        if (size) return size;
    } catch {
        // Fall through to <img> — some browsers reject certain formats in createImageBitmap.
    }
    try {
        return await viaImageElement(file);
    } catch {
        return null;
    }
};
