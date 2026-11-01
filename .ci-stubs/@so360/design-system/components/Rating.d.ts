import React from 'react';
export interface RatingProps {
    value?: number;
    defaultValue?: number;
    onChange?: (value: number) => void;
    max?: number;
    allowHalf?: boolean;
    readOnly?: boolean;
    disabled?: boolean;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Star rating. Interactive = role="slider"; readOnly = role="img". Clicking the current value clears it. */
export declare const Rating: React.FC<RatingProps>;
