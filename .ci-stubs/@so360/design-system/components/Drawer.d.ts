import React from 'react';
export interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** Optional line under the title. */
    subtitle?: string;
    /** Panel width. sm=400px, md=560px, lg=720px. */
    size?: 'sm' | 'md' | 'lg';
    /** Pinned action bar at the bottom of the panel. */
    footer?: React.ReactNode;
    /**
     * Back affordance in the header. The platform UX rule is drawer-first with
     * NO stacked surfaces: a flow that needs a second screen replaces the
     * drawer's content and offers this to return, it never opens a second
     * drawer or a modal on top.
     */
    onBack?: () => void;
    /** Non-scrolling strip between header and body, e.g. a section nav. */
    toolbar?: React.ReactNode;
    /** Ref to the scrolling body, for scroll-spy / "more below" hints. */
    bodyRef?: React.Ref<HTMLDivElement>;
    onBodyScroll?: React.UIEventHandler<HTMLDivElement>;
    name?: string;
    'data-testid'?: string;
    children: React.ReactNode;
}
/**
 * Right-hand slide-over panel — the platform's primary create/edit surface
 * (UX guide: drawer-first navigation; never stack modal-on-modal).
 */
export declare const Drawer: React.FC<DrawerProps>;
