import React from 'react';
export interface ToggleGroupItem {
    value: string;
    label?: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    /** Required for icon-only items. */
    'aria-label'?: string;
    disabled?: boolean;
}
export interface ToggleGroupProps {
    items: ToggleGroupItem[];
    /** 'single' (default) allows at most one pressed item; 'multiple' any number. */
    type?: 'single' | 'multiple';
    /** Pressed values (always an array; at most one entry in single mode). */
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
    /** Single mode: whether pressing the active item clears it. Default true. */
    allowDeselect?: boolean;
    size?: 'sm' | 'md';
    disabled?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
export declare const ToggleGroup: React.FC<ToggleGroupProps>;
