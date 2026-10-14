import React from 'react';
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

export const Table = <T extends { id: string }>({
    data,
    columns,
    isLoading,
    onRowClick,
    emptyMessage = "No records found"
}: TableProps<T>) => {
    if (isLoading) return <TableSkeleton />;

    if (data.length === 0) {
        return (
            <div className="bg-surface/50 border border-line rounded-xl p-12 text-center text-fg-subtle">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
                <thead className="bg-surface text-fg-muted font-medium border-b border-line">
                    <tr>
                        {columns.map((col, i) => (
                            <th key={i} className={`px-6 py-4 ${col.className}`}>
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-line bg-bg">
                    {data.map((item) => (
                        <tr
                            key={item.id}
                            onClick={() => onRowClick?.(item)}
                            className={`hover:bg-surface transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                        >
                            {columns.map((col, i) => (
                                <td key={i} className={`px-6 py-4 ${col.className}`}>
                                    {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as React.ReactNode)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
