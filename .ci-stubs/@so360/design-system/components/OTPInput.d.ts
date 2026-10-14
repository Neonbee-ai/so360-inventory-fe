import React from 'react';
export interface OTPInputProps {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    /** Fired once when every box is filled. */
    onComplete?: (value: string) => void;
    length?: number;
    type?: 'numeric' | 'alphanumeric';
    /** Render entered characters as dots. */
    mask?: boolean;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** One-time-code entry: one box per character, paste distribution, auto-advance. */
export declare const OTPInput: React.FC<OTPInputProps>;
