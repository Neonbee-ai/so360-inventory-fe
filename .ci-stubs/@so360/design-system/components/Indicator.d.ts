import React from 'react';
export type IndicatorTone = 'danger' | 'primary' | 'success' | 'warning' | 'info';
export type IndicatorPlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export interface IndicatorProps {
    /** Element the indicator decorates (bell, avatar, nav icon...). */
    children: React.ReactNode;
    /** Number to show. With no count the indicator is a plain dot (when `dot`). */
    count?: number;
    /** Render a small dot instead of a number. */
    dot?: boolean;
    /** Counts above this show as "99+". */
    max?: number;
    /** Show the badge even when count is 0. */
    showZero?: boolean;
    /** Force-hide the badge. */
    hidden?: boolean;
    tone?: IndicatorTone;
    placement?: IndicatorPlacement;
    /** Screen-reader text; defaults to "n notifications". */
    label?: string;
    className?: string;
}
/** Notification dot / count badge that wraps any child. */
export declare const Indicator: React.FC<IndicatorProps>;
