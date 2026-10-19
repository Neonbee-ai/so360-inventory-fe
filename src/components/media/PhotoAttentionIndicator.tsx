import React from 'react';
import { Badge } from '@so360/design-system';

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
            className="inline-flex"
        >
            <Badge tone="warning" size="sm">⚠ Photos</Badge>
        </span>
    );
};

export default PhotoAttentionIndicator;
