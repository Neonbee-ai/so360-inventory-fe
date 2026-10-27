import React from 'react';
export interface FormFieldContextValue {
    /** id to put on the control so the label's htmlFor resolves. */
    id: string;
    /** space-separated hint/error ids for aria-describedby (undefined when none). */
    describedBy?: string;
    invalid: boolean;
    required: boolean;
    name: string;
}
/** Returns the enclosing FormField's wiring, or null when used standalone. */
export declare const useFormFieldContext: () => FormFieldContextValue | null;
export type FormFieldSize = 'sm' | 'md';
/** Shared token-only control chrome for text-like controls. */
export declare function fieldControlClass(invalid: boolean, size?: FormFieldSize): string;
export interface FormFieldProps {
    label: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    /** An element, or a render-prop receiving the generated wiring. */
    children: React.ReactNode | ((ctx: FormFieldContextValue) => React.ReactNode);
    className?: string;
    'data-testid'?: string;
}
export declare const FormField: React.FC<FormFieldProps>;
