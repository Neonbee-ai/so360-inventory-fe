import React from 'react';
import { type FormFieldContextValue } from './FormField';
export interface FieldShellProps {
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    className?: string;
    'data-testid'?: string;
    /** Receives FormField wiring when a label is given, otherwise null. */
    children: (ctx: FormFieldContextValue | null) => React.ReactNode;
}
/**
 * Internal helper for Batch-A inputs: wraps a control in FormField when `label`
 * is set (label/hint/error/required wiring), else renders it bare plus an inline error.
 */
export declare const FieldShell: React.FC<FieldShellProps>;
