/**
 * items.image_meta — the measured natural size of each product photo.
 * The API derives items.image_needs_attention from it (same thresholds as
 * the thumbnail badge in ./imageRatio).
 */
export interface ImageMetaEntry {
    url: string;
    width: number;
    height: number;
}

/** Record a measurement, replacing any earlier entry for the same url. */
export const upsertImageMeta = (
    meta: ImageMetaEntry[],
    url: string,
    width: number,
    height: number,
): ImageMetaEntry[] => {
    const w = Math.round(width);
    const h = Math.round(height);
    if (!url || !(w > 0) || !(h > 0)) return meta;
    const existing = meta.find(m => m.url === url);
    if (existing && existing.width === w && existing.height === h) return meta;
    return [...meta.filter(m => m.url !== url), { url, width: w, height: h }];
};

/** Entries for the photos the item currently shows, in image_urls order. */
export const imageMetaForUrls = (meta: ImageMetaEntry[] | null | undefined, urls: string[]): ImageMetaEntry[] => {
    const byUrl = new Map((Array.isArray(meta) ? meta : []).map(m => [m.url, m] as const));
    return urls.map(u => byUrl.get(u)).filter((m): m is ImageMetaEntry => !!m);
};
