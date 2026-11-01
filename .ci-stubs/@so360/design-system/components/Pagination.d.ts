import React from 'react';
export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    showPageSizeSelector?: boolean;
    showItemCount?: boolean;
    className?: string;
}
export declare const Pagination: React.FC<PaginationProps>;
