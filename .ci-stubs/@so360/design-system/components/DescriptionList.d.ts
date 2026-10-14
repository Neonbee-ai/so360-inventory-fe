import React from 'react';
export interface DescriptionItem {
    label: string;
    value: React.ReactNode;
    /** Number of columns this item spans (clamped to the list's columns). */
    span?: number;
    /** Skip the item entirely. */
    hidden?: boolean;
}
export interface DescriptionListProps {
    items: DescriptionItem[];
    columns?: 1 | 2 | 3;
    /** stacked: label above value. inline: label left, value right. */
    layout?: 'stacked' | 'inline';
    title?: string;
    /** Shown when a value is null / undefined / empty string. */
    emptyValue?: string;
    /** Draw dividers between rows. */
    bordered?: boolean;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/** Key–value pairs for record detail pages (customer, invoice, lead...). */
export declare const DescriptionList: React.FC<DescriptionListProps>;
