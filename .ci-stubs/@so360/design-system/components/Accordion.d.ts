import React from 'react';
export interface AccordionItem {
    id: string;
    title: React.ReactNode;
    content: React.ReactNode;
    disabled?: boolean;
}
export interface AccordionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    items: AccordionItem[];
    /** single: one panel at a time; multiple: any number. */
    type?: 'single' | 'multiple';
    /** Open item ids (controlled). */
    value?: string[];
    defaultValue?: string[];
    onValueChange?: (value: string[]) => void;
    /** In single mode, allow closing the open panel. Default true. */
    collapsible?: boolean;
}
export declare const Accordion: React.FC<AccordionProps>;
