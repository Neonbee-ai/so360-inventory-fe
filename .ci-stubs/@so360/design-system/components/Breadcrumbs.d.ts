import React from 'react';
export interface BreadcrumbItem {
    label: string;
    href?: string;
    onClick?: () => void;
}
export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
    items: BreadcrumbItem[];
    /** Max crumbs visible; middle crumbs collapse into an ellipsis menu. */
    maxItems?: number;
}
export declare const Breadcrumbs: React.FC<BreadcrumbsProps>;
