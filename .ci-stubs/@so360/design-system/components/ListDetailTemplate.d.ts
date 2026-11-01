import React from 'react';
export interface ListDetailTemplateProps {
    list: React.ReactNode;
    detail: React.ReactNode;
    /** True when an item is selected. On compact/medium windows this switches the single visible pane to the detail. */
    hasSelection: boolean;
    /** Called by the back button on small windows. */
    onBack?: () => void;
    backLabel?: string;
    /** Shown in the detail pane when nothing is selected (two-pane layout only). */
    emptyDetail?: React.ReactNode;
    className?: string;
}
/** M3 canonical list-detail: two panes at wc-expanded+, one pane (with back) below. */
export declare const ListDetailTemplate: React.FC<ListDetailTemplateProps>;
