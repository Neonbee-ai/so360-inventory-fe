import React from 'react';
export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'horizontal' | 'vertical';
    /** Accessible name for the group. */
    'aria-label'?: string;
}
/**
 * Visually attaches direct-child `<Button>`s (shared borders, only outer corners rounded).
 * Children must be direct button elements.
 */
export declare const ButtonGroup: React.FC<ButtonGroupProps>;
