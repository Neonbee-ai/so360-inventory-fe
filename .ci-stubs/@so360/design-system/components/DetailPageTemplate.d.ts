import React from 'react';
import { BreadcrumbItem } from './Breadcrumbs';
export interface DetailPageTemplateProps {
    breadcrumbs?: BreadcrumbItem[];
    /** Shows a back button (use on compact screens / drill-downs). */
    onBack?: () => void;
    backLabel?: string;
    title: string;
    /** Status badge next to the title. */
    status?: React.ReactNode;
    actions?: React.ReactNode;
    /** Main column. */
    children: React.ReactNode;
    /** Supporting pane (M3): sits beside main at wc-expanded, stacks below on smaller windows. */
    sidePanel?: React.ReactNode;
    className?: string;
}
/** Record detail page: breadcrumb/back → title + status + actions → main + optional supporting pane. */
export declare const DetailPageTemplate: React.FC<DetailPageTemplateProps>;
