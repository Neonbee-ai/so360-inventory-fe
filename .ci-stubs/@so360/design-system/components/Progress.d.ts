import React from 'react';
export type ProgressTone = 'brand' | 'success' | 'warning' | 'danger';
export type ProgressSize = 'sm' | 'md' | 'lg';
export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
    /** Current value; omit for indeterminate. */
    value?: number;
    max?: number;
    variant?: 'linear' | 'circular';
    tone?: ProgressTone;
    size?: ProgressSize;
    /** Accessible name and visible caption. */
    label?: string;
    /** Show the percentage (linear: next to label, circular: centre). */
    showValue?: boolean;
}
export declare const Progress: React.FC<ProgressProps>;
