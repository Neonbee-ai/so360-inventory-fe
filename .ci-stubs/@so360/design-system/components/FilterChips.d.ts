import React from 'react';
export interface FilterOption {
    value: string;
    label: string;
}
export interface FilterDefinition {
    key: string;
    label: string;
    options: FilterOption[];
    /** `single` = radio (default), `multiple` = checkboxes. */
    mode?: 'single' | 'multiple';
}
export type FilterValues = Record<string, string[]>;
export interface FilterChipsProps {
    filters: FilterDefinition[];
    /** Active selections keyed by filter key (controlled). */
    value?: FilterValues;
    defaultValue?: FilterValues;
    onChange?: (value: FilterValues) => void;
    /** Show a "Clear all" button when any filter is active (default true). */
    showClearAll?: boolean;
    name?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare const FilterChips: React.FC<FilterChipsProps>;
