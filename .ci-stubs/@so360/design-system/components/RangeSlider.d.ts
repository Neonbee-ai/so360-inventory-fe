import React from 'react';
export interface RangeSliderProps {
    value?: [number, number];
    defaultValue?: [number, number];
    onChange?: (value: [number, number]) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    formatValue?: (v: number) => string;
    showValue?: boolean;
    'data-testid'?: string;
}
/** Two-thumb slider; thumbs cannot cross. */
export declare const RangeSlider: React.FC<RangeSliderProps>;
