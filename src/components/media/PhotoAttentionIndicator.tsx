import React from 'react';

/**
 * Small ⚠ shown on an item row when the API has flagged its photos
 * (items.image_needs_attention: a photo under 800px or far from square).
 */
const PhotoAttentionIndicator: React.FC<{ needsAttention?: boolean }> = ({ needsAttention }) => {
    if (!needsAttention) return null;
    return (
        <span
            data-testid="photo-attention"
            role="img"
            aria-label="Photos need attention"
            title="Photos need attention — a photo is small (under 800px) or far from square, so it may look blurry or tiny in the store."
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold"
        >
            ⚠ Photos
        </span>
    );
};

export default PhotoAttentionIndicator;
