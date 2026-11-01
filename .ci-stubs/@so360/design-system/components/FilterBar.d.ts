import React from 'react';
export interface FilterOption {
    value: string;
    label: string;
}
export interface FilterConfig {
    key: string;
    label: string;
    type: 'select' | 'multiselect' | 'text' | 'date' | 'daterange';
    options?: FilterOption[];
    placeholder?: string;
}
export interface ActiveFilter {
    key: string;
    value: string | string[];
    label: string;
}
export interface FilterBarProps {
    filters: FilterConfig[];
    activeFilters: Record<string, string | string[]>;
    onFilterChange: (key: string, value: string | string[] | null) => void;
    onClearAll: () => void;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    className?: string;
}
export declare const FilterBar: React.FC<FilterBarProps>;
