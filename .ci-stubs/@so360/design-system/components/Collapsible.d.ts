import React from 'react';
/** Animated height wrapper (CSS grid rows 0fr -> 1fr). Closed content is removed from a11y tree & tab order. */
export declare const CollapsePanel: React.FC<React.HTMLAttributes<HTMLDivElement> & {
    open: boolean;
    labelledBy?: string;
}>;
export interface CollapsibleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'title'> {
    /** Trigger label / content. */
    trigger: React.ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
}
export declare const Collapsible: React.FC<CollapsibleProps>;
