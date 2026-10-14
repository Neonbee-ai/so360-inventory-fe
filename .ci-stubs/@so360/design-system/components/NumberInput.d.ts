import React from 'react';
import type { FormFieldSize } from './FormField';
export interface NumberInputProps {
    /** Controlled value (null = empty). */
    value?: number | null;
    defaultValue?: number | null;
    onChange?: (value: number | null) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    size?: FormFieldSize;
    id?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare function clampNumber(n: number, min?: number, max?: number): number;
/** Numeric spinbutton with +/- stepper, min/max/step and arrow-key support. */
export declare const NumberInput: React.ForwardRefExoticComponent<NumberInputProps & React.RefAttributes<HTMLInputElement>>;
