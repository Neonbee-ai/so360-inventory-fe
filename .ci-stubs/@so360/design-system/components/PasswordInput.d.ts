import React from 'react';
import { type FormFieldSize } from './FormField';
export interface PasswordStrength {
    /** 0 (empty/very weak) .. 4 (strong) */
    score: 0 | 1 | 2 | 3 | 4;
    label: string;
}
export declare function scorePassword(pw: string): PasswordStrength;
export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    /** Show the strength meter under the field. */
    showStrength?: boolean;
    /** Override the default heuristic. */
    getStrength?: (password: string) => PasswordStrength;
    'data-testid'?: string;
}
export declare const PasswordInput: React.ForwardRefExoticComponent<PasswordInputProps & React.RefAttributes<HTMLInputElement>>;
