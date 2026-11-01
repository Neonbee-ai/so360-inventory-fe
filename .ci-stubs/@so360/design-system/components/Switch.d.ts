import React from 'react';
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'type'> {
    label: string;
    name: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    'data-testid'?: string;
}
export declare const Switch: React.FC<SwitchProps>;
