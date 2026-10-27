import React from 'react';
import { type FormFieldSize } from './FormField';
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    /** Omit when nesting inside your own FormField. */
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    leadingIcon?: React.ComponentType<{
        className?: string;
    }>;
    'data-testid'?: string;
}
export declare const TextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<HTMLInputElement>>;
