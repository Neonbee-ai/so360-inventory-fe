import React from 'react';
import { type FormFieldSize } from './FormField';
export interface DateInputProps {
    /** ISO date 'YYYY-MM-DD' ('' = empty). Controlled when provided. */
    value?: string;
    defaultValue?: string;
    /** Fires with an ISO date when a valid date is typed, or '' when cleared. */
    onChange?: (iso: string) => void;
    /** ISO bounds (inclusive). */
    min?: string;
    max?: string;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    size?: FormFieldSize;
    id?: string;
    className?: string;
    /** Slot rendered inside the right edge of the control (e.g. calendar button). */
    trailing?: React.ReactNode;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Masked, typed date entry (DD/MM/YYYY) with validation. */
export declare const DateInput: React.ForwardRefExoticComponent<DateInputProps & React.RefAttributes<HTMLInputElement>>;
