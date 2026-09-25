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
/** Width/height range that fills square and 3:4 frames without heavy padding. */
const GOOD_RATIO_MIN = 0.7;
const GOOD_RATIO_MAX = 1.4;

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
