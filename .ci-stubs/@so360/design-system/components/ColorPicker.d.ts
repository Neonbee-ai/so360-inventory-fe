import React from 'react';
export declare const defaultColorSwatches: string[];
/** Normalise '#abc' / 'abc' / '#aabbcc' to '#AABBCC'; returns null if invalid. */
export declare function normalizeHex(input: string): string | null;
export interface ColorPickerProps {
    /** '#RRGGBB' or '' (controlled when provided). */
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    swatches?: string[];
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Swatch radiogroup (arrow-key roving) plus a hex field. */
export declare const ColorPicker: React.FC<ColorPickerProps>;
