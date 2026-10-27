import React from 'react';
import { type FormFieldSize } from './FormField';
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** Omit when nesting inside your own FormField. */
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    'data-testid'?: string;
}
export declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
