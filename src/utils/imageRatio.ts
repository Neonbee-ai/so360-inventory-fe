/**
 * Size/shape check for product photos, shown on each thumbnail so merchants
 * can see what the storefront will do with an image.
 *
 * Storefront themes show product photos in square frames (portrait 3:4 for
 * fashion) and fit odd shapes with padding, so a photo far from those shapes
 * still works but renders small with wide bands around it.
 */

const COMMON_RATIOS: Array<[number, number]> = [
    [1, 1], [4, 5], [3, 4], [2, 3], [9, 16],
    [5, 4], [4, 3], [3, 2], [16, 9],
];

/** Shortest side below this looks soft on large product pages. */
export const MIN_RECOMMENDED_PX = 800;
/**
 * Width/height range that fills square and 3:4 frames without heavy padding.
 * Mirrored by so360-inventory-be `src/inventory/image-meta.ts`, which derives
 * items.image_needs_attention from the same numbers — keep them in step.
 */
export const GOOD_RATIO_MIN = 0.7;
export const GOOD_RATIO_MAX = 1.4;

export const ratioLabel = (width: number, height: number): string => {
    const r = width / height;
    for (const [a, b] of COMMON_RATIOS) {
        if (Math.abs(r - a / b) / (a / b) < 0.03) return `${a}:${b}`;
    }
    return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
};

export interface ProductImageAssessment {
    size: string;
    ratio: string;
    ok: boolean;
    issues: string[];
}

export const assessProductImage = (width: number, height: number): ProductImageAssessment => {
    const issues: string[] = [];
    if (Math.min(width, height) < MIN_RECOMMENDED_PX) {
        issues.push(`Low resolution (under ${MIN_RECOMMENDED_PX}px) — may look blurry. Aim for 1200×1200 or larger.`);
    }
    const r = width / height;
    if (r < GOOD_RATIO_MIN || r > GOOD_RATIO_MAX) {
        issues.push(`Very ${r < 1 ? 'tall' : 'wide'} — the store shows it small with wide padding. Square (1:1) photos fill product cards best.`);
    }
    return { size: `${width}×${height}`, ratio: ratioLabel(width, height), ok: issues.length === 0, issues };
};

/** Same rule the API uses for items.image_needs_attention. */
export const productImageNeedsAttention = (width: number, height: number): boolean =>
    !assessProductImage(width, height).ok;

/**
 * An upload slot with a fixed target shape — e.g. a square category tile or a
 * wide 16:5 category banner. Product photos use assessProductImage instead,
 * which accepts a range of shapes.
 */
export interface ImageSlotSpec {
    /** Target width/height, e.g. 1 for square, 16 / 5 for a banner. */
    ratio: number;
    /** Recommended size, shown in hints ("1600×1600"). */
    recommendedWidth: number;
    recommendedHeight: number;
    /** Shortest side below this is flagged as low resolution. Default: half the recommended short side. */
    minShortSide?: number;
    /** Allowed relative deviation from the ratio before it is flagged. Default 0.15 (15%). */
    ratioTolerance?: number;
}

export const CATEGORY_IMAGE_SLOT: ImageSlotSpec = { ratio: 1, recommendedWidth: 1600, recommendedHeight: 1600 };
export const CATEGORY_BANNER_SLOT: ImageSlotSpec = { ratio: 16 / 5, recommendedWidth: 2400, recommendedHeight: 750 };

const slotRatioLabel = (ratio: number): string => {
    for (const [a, b] of [...COMMON_RATIOS, [16, 5] as [number, number], [3, 1] as [number, number]]) {
        if (Math.abs(ratio - a / b) < 1e-6) return `${a}:${b}`;
    }
    return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
};

export const assessImageForSlot = (width: number, height: number, slot: ImageSlotSpec): ProductImageAssessment => {
    const issues: string[] = [];
    const recShort = Math.min(slot.recommendedWidth, slot.recommendedHeight);
    const minShort = slot.minShortSide ?? Math.round(recShort / 2);
    const tolerance = slot.ratioTolerance ?? 0.15;
    const target = `${slot.recommendedWidth}×${slot.recommendedHeight}`;
    if (Math.min(width, height) < minShort) {
        issues.push(`Low resolution (under ${minShort}px on the short side) — may look blurry. Aim for ${target}.`);
    }
    const r = width / height;
    if (Math.abs(r - slot.ratio) / slot.ratio > tolerance) {
        issues.push(`Shape is ${ratioLabel(width, height)}; this slot is ${slotRatioLabel(slot.ratio)} (${target}) — the image will be cropped.`);
    }
    return { size: `${width}×${height}`, ratio: ratioLabel(width, height), ok: issues.length === 0, issues };
};
