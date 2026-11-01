import React from 'react';
import { type FormFieldSize } from './FormField';
export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    /** Omit when nesting inside your own FormField. */
    label?: string;
    name: string;
    options: SelectOption[];
    /** Renders a disabled, empty-valued first option. */
    placeholder?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    'data-testid'?: string;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
