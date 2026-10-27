import React from 'react';
export interface DataTableColumn<T> {
    key: string;
    /** Plain text, or a node such as a SortableHeader. */
    header: React.ReactNode;
    /** Defaults to rendering `row[key]` as text. */
    render?: (row: T) => React.ReactNode;
    /** Tailwind width class for the column, e.g. 'w-32'. */
    widthClassName?: string;
}
export interface DataTableProps<T> {
    /**
     * UX guide caps default views at 7 columns — more than that belongs behind
     * a detail drawer, not in the grid. Enforced in dev via console.warn
     * rather than a throw so a violation degrades instead of crashing.
     */
    columns: DataTableColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    loading?: boolean;
    /** Rendered when rows is empty and not loading. */
    emptyState?: React.ReactNode;
    onRowClick?: (row: T) => void;
    /** Number of skeleton rows while loading. */
    skeletonRows?: number;
    /**
     * Row selection (bulk approve / bulk edit). Controlled: pass the selected
     * row keys and receive the next set. Omit both to render no checkbox column.
     */
    selectedKeys?: ReadonlySet<string>;
    onSelectionChange?: (keys: Set<string>) => void;
    /** Rows that may not be selected (e.g. already approved). */
    isRowSelectable?: (row: T) => boolean;
    name?: string;
    'data-testid'?: string;
}
/**
 * Standard master-data table — replaces the hand-rolled slate `<table>` blocks
 * copy-pasted across module list pages. Deliberately minimal: sorting, paging
 * and filtering compose from SortableHeader / Pagination / FilterBar rather
 * than being baked in.
 */
export declare function DataTable<T>(props: DataTableProps<T>): React.ReactElement;
