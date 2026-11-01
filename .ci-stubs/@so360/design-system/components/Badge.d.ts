import React from 'react';
export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';
export interface BadgeProps {
    tone?: BadgeTone;
    size?: BadgeSize;
    /** Show a leading status dot. */
    dot?: boolean;
    children?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
}
export declare const BADGE_TONES: Record<BadgeTone, {
    box: string;
    dot: string;
}>;
export declare const Badge: React.FC<BadgeProps>;
