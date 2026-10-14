import React from 'react';
import { MenuItem } from './Menu';
export interface ListPageTemplateProps {
    title: string;
    description?: string;
    /** The single most important action (Von Restorff / Hick: one emphasised CTA per page). */
    primaryAction?: React.ReactNode;
    /** Everything else lives in an overflow menu, never as extra buttons. */
    secondaryActions?: MenuItem[];
    /** Search + filters row. */
    toolbar?: React.ReactNode;
    /** The list / table. */
    children: React.ReactNode;
    /** Pagination or summary. */
    footer?: React.ReactNode;
    className?: string;
}
/** Standard list page: header (title + one primary action) → toolbar → content → footer. */
export declare const ListPageTemplate: React.FC<ListPageTemplateProps>;
