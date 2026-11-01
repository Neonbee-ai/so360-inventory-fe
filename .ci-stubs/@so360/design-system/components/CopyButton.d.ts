import React from 'react';
export interface CopyButtonProps {
    /** Text written to the clipboard. */
    value: string;
    /** Visible text; omit for an icon-only button (aria-label is used). */
    children?: React.ReactNode;
    /** Accessible name for the idle state. */
    label?: string;
    copiedLabel?: string;
    /** ms the success state is shown. */
    resetMs?: number;
    onCopy?: (value: string) => void;
    onError?: (error: unknown) => void;
    size?: 'sm' | 'md';
    disabled?: boolean;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
export declare const CopyButton: React.FC<CopyButtonProps>;
