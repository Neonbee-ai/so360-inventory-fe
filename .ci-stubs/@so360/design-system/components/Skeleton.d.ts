import React from 'react';
export type SkeletonVariant = 'text' | 'rect' | 'circle';
export interface SkeletonProps {
    variant?: SkeletonVariant;
    /** Number of text lines (variant="text" only). */
    lines?: number;
    className?: string;
    'data-testid'?: string;
}
export declare const Skeleton: React.FC<SkeletonProps>;
