import React from 'react';
import { type FormFieldSize } from './FormField';
export interface PhoneCountry {
    /** ISO 3166-1 alpha-2. */
    code: string;
    name: string;
    /** Dial code without '+'. */
    dial: string;
}
export declare const defaultPhoneCountries: PhoneCountry[];
export interface PhoneInputProps {
    /** E.164-style '+<dial><digits>' ('' = empty). Controlled when provided. */
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    onCountryChange?: (country: PhoneCountry) => void;
    /** ISO alpha-2 used when the value has no dial prefix. Default 'IN'. */
    defaultCountry?: string;
    countries?: PhoneCountry[];
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
/** Country-code select + national number. Emits '+<dial><digits>'. */
export declare const PhoneInput: React.ForwardRefExoticComponent<PhoneInputProps & React.RefAttributes<HTMLInputElement>>;
