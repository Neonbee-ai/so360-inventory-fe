import React from 'react';
import { type FormFieldSize } from './FormField';
export interface ComboboxOption {
    value: string;
    label: string;
    description?: string;
    group?: string;
    disabled?: boolean;
}
export interface ComboboxProps {
    options: ComboboxOption[];
    /** Selected option value (controlled). `null` = nothing selected. */
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (value: string | null, option: ComboboxOption | null) => void;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
    size?: FormFieldSize;
    /** Show a clear (x) button when a value is selected. */
    clearable?: boolean;
    emptyText?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Searchable single-select. The value is an option value (not free text). */
export declare const Combobox: React.FC<ComboboxProps>;
