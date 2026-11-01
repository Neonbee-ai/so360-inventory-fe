import React from 'react';
export type SpinnerSize = 'sm' | 'md' | 'lg';
export interface SpinnerProps {
    size?: SpinnerSize;
    'aria-label'?: string;
    className?: string;
    'data-testid'?: string;
}
export declare const Spinner: React.FC<SpinnerProps>;
