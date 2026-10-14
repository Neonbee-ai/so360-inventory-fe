import React from 'react';
export interface SegmentedOption {
    value: string;
    label: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    disabled?: boolean;
}
export interface SegmentedControlProps {
    options: SegmentedOption[];
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    disabled?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/** Single-choice radiogroup rendered as joined buttons. Arrow keys move + select (roving tabindex). */
export declare const SegmentedControl: React.FC<SegmentedControlProps>;
