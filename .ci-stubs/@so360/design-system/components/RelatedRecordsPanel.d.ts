import React from 'react';
import type { LinkRef } from '@so360/cross-link';
export interface RelatedRecordsTab {
    /** Stable key for the tab. */
    key: string;
    /** Tab label, e.g. 'Invoices'. */
    label: string;
    /** Lazy loader — called the first time the tab is opened. */
    load: () => Promise<LinkRef[]>;
    /** Optional eager count shown as a badge before the tab is opened. */
    count?: number;
}
export interface RelatedRecordsPanelProps {
    tabs: RelatedRecordsTab[];
    /** Index of the tab open on mount. Default 0. */
    defaultTab?: number;
    /** Heading above the tab strip. */
    title?: string;
    className?: string;
    /** Rendered when a loaded tab has no records. */
    emptyLabel?: string;
}
/**
 * Detail-page panel that groups cross-module related records into lazy tabs.
 * Each tab supplies its own loader (using the host module's service), so the
 * panel stays decoupled from any specific API. Chips inside resolve their
 * labels through the shared cross-link resolver (one coalesced fetch).
 */
export declare const RelatedRecordsPanel: React.FC<RelatedRecordsPanelProps>;
