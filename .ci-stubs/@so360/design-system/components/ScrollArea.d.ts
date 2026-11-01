import React from 'react';
export type ScrollOrientation = 'vertical' | 'horizontal' | 'both';
export type ScrollFadeFrom = 'bg' | 'surface' | 'surface-raised';
export interface ScrollAreaProps {
    children: React.ReactNode;
    orientation?: ScrollOrientation;
    /** CSS max-height (number = px). Needed for vertical scrolling inside auto-height parents. */
    maxHeight?: number | string;
    /** Surface the container sits on, so the fade blends in. */
    fadeFrom?: ScrollFadeFrom;
    /** Accessible name; makes the scroller a labelled, keyboard-focusable region. */
    label?: string;
    className?: string;
    'data-testid'?: string;
}
/** Styled scroll container with fade shadows that appear only where content continues. */
export declare const ScrollArea: React.FC<ScrollAreaProps>;
