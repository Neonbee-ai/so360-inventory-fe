import React from 'react';
export interface StepItem {
    label: string;
    description?: string;
    /** Marks the step as failed (overrides complete). */
    error?: boolean;
}
export interface StepperProps extends Omit<React.HTMLAttributes<HTMLOListElement>, 'onChange'> {
    steps: StepItem[];
    /** Zero-based index of the current step. */
    current: number;
    orientation?: 'horizontal' | 'vertical';
    /** When provided, completed/previous steps become clickable. */
    onStepClick?: (index: number) => void;
}
export declare const Stepper: React.FC<StepperProps>;
