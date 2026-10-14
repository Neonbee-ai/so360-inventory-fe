import React from 'react';
export type HoverCardSide = 'bottom' | 'top';
export type HoverCardAlign = 'start' | 'center' | 'end';
export interface HoverCardProps {
    /** Single focusable element (link/button) that reveals the card on hover or focus. */
    trigger: React.ReactElement<Record<string, unknown>>;
    /** Rich preview content (customer card, deal summary...). */
    children: React.ReactNode;
    side?: HoverCardSide;
    align?: HoverCardAlign;
    /** Hover delay before opening, in ms. Keyboard focus opens immediately. */
    openDelay?: number;
    /** Grace period before closing so the pointer can travel onto the card. */
    closeDelay?: number;
    /** Accessible name of the card. */
    label?: string;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/**
 * Rich preview card shown on hover or keyboard focus. Stays open while the
 * pointer is over the trigger OR the card; Escape dismisses it.
 */
export declare const HoverCard: React.FC<HoverCardProps>;
