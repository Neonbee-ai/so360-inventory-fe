import React from 'react';
export interface MultiSelectOption {
    value: string;
    label: string;
    description?: string;
    group?: string;
    disabled?: boolean;
}
export interface MultiSelectProps {
    options: MultiSelectOption[];
    value?: string[];
    defaultValue?: string[];
    onChange?: (values: string[]) => void;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
    /** Maximum number of selections; further options become unselectable. */
    max?: number;
    emptyText?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Searchable multi-select. The popup stays open while picking; selections show as removable chips. */
export declare const MultiSelect: React.FC<MultiSelectProps>;
