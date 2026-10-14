import React from 'react';
export interface TabItem {
    id: string;
    label: string;
    badge?: React.ReactNode;
    disabled?: boolean;
}
export interface TabsProps {
    items: TabItem[];
    /** Controlled active tab id. */
    value?: string;
    /** Uncontrolled initial tab id (defaults to first enabled). */
    defaultValue?: string;
    onChange?: (id: string) => void;
    /** Render the content of the active panel. */
    children?: (id: string) => React.ReactNode;
    /** Accessible name for the tablist and testid suffix. */
    name?: string;
    className?: string;
    'data-testid'?: string;
}
export declare const Tabs: React.FC<TabsProps>;
