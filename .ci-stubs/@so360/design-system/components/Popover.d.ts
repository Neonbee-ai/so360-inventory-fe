import React from 'react';
export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
export interface PopoverProps {
    /** Single element; receives aria-expanded, aria-controls and onClick. */
    trigger: React.ReactElement<Record<string, unknown>>;
    /** Panel content, or a render function receiving `close`. */
    content: React.ReactNode | ((api: {
        close: () => void;
    }) => React.ReactNode);
    placement?: PopoverPlacement;
    name?: string;
    /** Optional controlled state. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    'data-testid'?: string;
}
export declare const Popover: React.FC<PopoverProps>;
