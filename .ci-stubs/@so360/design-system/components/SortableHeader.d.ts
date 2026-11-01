import React from 'react';
export type SortDirection = 'asc' | 'desc' | null;
export interface SortState {
    field: string;
    direction: SortDirection;
}
export interface SortableHeaderProps {
    label: string;
    field: string;
    currentSort: SortState | null;
    onSort: (field: string) => void;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
    className?: string;
}
export declare const SortableHeader: React.FC<SortableHeaderProps>;
