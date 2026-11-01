import React from 'react';
/** Snap `v` to the nearest `step` (anchored at `min`) and clamp to [min, max]. */
export declare function snapToStep(v: number, min: number, max: number, step: number): number;
export interface SliderThumbProps {
    value: number;
    min: number;
    max: number;
    step: number;
    /** Lower/upper bound this thumb may reach (used by RangeSlider). */
    lowerBound?: number;
    upperBound?: number;
    onChange: (v: number) => void;
    disabled?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    valueText?: string;
    /** Track element used to translate pointer position to value. */
    trackRef: React.RefObject<HTMLElement | null>;
    'data-testid'?: string;
}
/** Draggable, keyboard-operable role="slider" thumb. */
export declare const SliderThumb: React.FC<SliderThumbProps>;
export interface SliderProps {
    value?: number;
    defaultValue?: number;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    /** Formats the value shown at the right and announced as aria-valuetext. */
    formatValue?: (v: number) => string;
    showValue?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare const Slider: React.FC<SliderProps>;
