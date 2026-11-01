import React from 'react';
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: string;
    name: string;
    description?: string;
    /** Visual mixed state; set imperatively via ref (not an HTML attribute). */
    indeterminate?: boolean;
    'data-testid'?: string;
}
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
