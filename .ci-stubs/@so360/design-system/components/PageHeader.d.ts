import React from 'react';
export interface Breadcrumb {
    label: string;
    href?: string;
    onClick?: () => void;
}
export interface PageHeaderProps {
    title: string;
    description?: string;
    breadcrumbs?: Breadcrumb[];
    actions?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
}
export declare const PageHeader: React.FC<PageHeaderProps>;
