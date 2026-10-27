import React from 'react';
export interface RadioOption {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
}
export interface RadioGroupProps {
    /** Shared native radio name; also drives the testid. */
    name: string;
    /** Group legend, referenced by aria-labelledby. */
    label: string;
    options: RadioOption[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
    orientation?: 'vertical' | 'horizontal';
    className?: string;
    /** Group testid override; defaults to radio-<name>. Each input is radio-<name>-<value>. */
    'data-testid'?: string;
}
export declare const RadioGroup: React.FC<RadioGroupProps>;
