import React from 'react';
export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export interface TooltipProps {
    /** Short, meaningful label — e.g. "Refresh Data", "Delete Item". Avoid generic text like "Button". */
    content: string;
    children: React.ReactElement;
    side?: TooltipSide;
    /** Hover delay before showing, in ms. Keyboard focus always shows immediately. */
    delay?: number;
    disabled?: boolean;
    className?: string;
}
/**
 * Dependency-free tooltip: hover (delayed) + keyboard focus (immediate) triggers,
 * flips to whichever side keeps it inside the viewport, ARIA-described trigger,
 * fade in/out, theme-aware (slate tokens only — see reference_theme_contrast_slate_only).
 */
export declare const Tooltip: React.FC<TooltipProps>;
