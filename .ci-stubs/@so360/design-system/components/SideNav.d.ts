import React from 'react';
export interface SideNavItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    /** Count or short text shown at the right (and as a dot-badge when collapsed). */
    badge?: number | string;
    /** When set the item renders as a link; otherwise as a button. */
    href?: string;
    disabled?: boolean;
}
export interface SideNavSection {
    id: string;
    /** Section caption, hidden when the nav is collapsed. */
    title?: string;
    items: SideNavItem[];
}
export interface SideNavProps {
    sections: SideNavSection[];
    activeId?: string;
    onNavigate?: (item: SideNavItem) => void;
    /** Controlled collapsed state. */
    collapsed?: boolean;
    defaultCollapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    /** Brand/workspace block above the sections. */
    header?: React.ReactNode;
    /** Block below the sections (user, plan...). */
    footer?: React.ReactNode;
    /** Hide the collapse/expand toggle. */
    hideToggle?: boolean;
    label?: string;
    className?: string;
    'data-testid'?: string;
}
/** Collapsible application sidebar (expanded labels / collapsed icon-only with tooltips). */
export declare const SideNav: React.FC<SideNavProps>;
