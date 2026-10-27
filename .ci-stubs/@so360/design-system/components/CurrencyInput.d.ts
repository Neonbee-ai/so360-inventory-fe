import React from 'react';
import { type FormFieldSize } from './FormField';
export interface CurrencyInputProps {
    /** Amount in major units (e.g. rupees). null = empty. Controlled when provided. */
    value?: number | null;
    defaultValue?: number | null;
    onChange?: (value: number | null) => void;
    /** ISO 4217 code. Default 'INR'. */
    currency?: string;
    /** BCP-47 locale used for grouping (default 'en-IN' -> 12,34,567.50). */
    locale?: string;
    /** Override the currency's default fraction digits. */
    fractionDigits?: number;
    min?: number;
    max?: number;
    allowNegative?: boolean;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    size?: FormFieldSize;
    id?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Money entry: currency prefix, locale grouping when blurred, plain digits while editing. */
export declare const CurrencyInput: React.ForwardRefExoticComponent<CurrencyInputProps & React.RefAttributes<HTMLInputElement>>;
