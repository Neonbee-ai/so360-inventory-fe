import React from 'react';
import { DataTable, EmptyState, type DataTableColumn } from '@so360/design-system';
import { TableSkeleton } from './Skeleton';

interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    isLoading?: boolean;
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
}

/** Thin wrapper over Comb DataTable; keeps the legacy accessor-based column API. */
export const Table = <T extends { id: string }>({
    data,
    columns,
    isLoading,
    onRowClick,
    emptyMessage = 'No records found',
}: TableProps<T>) => {
    if (isLoading) return <TableSkeleton />;

    const combColumns: DataTableColumn<T>[] = columns.map((col, i) => ({
        key: `c${i}`,
        header: col.header,
        render: (item: T) =>
            typeof col.accessor === 'function'
                ? col.accessor(item)
                : (item[col.accessor] as React.ReactNode),
    }));

    return (
        <DataTable<T>
            columns={combColumns}
            rows={data}
            rowKey={(r) => r.id}
            onRowClick={onRowClick}
            emptyState={<EmptyState title={emptyMessage} />}
        />
    );
};
