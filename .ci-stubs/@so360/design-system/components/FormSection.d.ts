import React from 'react';
/** Miller's law: keep a chunk to ≤ 7 fields; split into more sections beyond this. */
export declare const FORM_SECTION_MAX_FIELDS = 7;
export interface FormSectionProps {
    title: string;
    description?: string;
    /** 1 (default) or 2 columns from wc-medium up. */
    columns?: 1 | 2;
    /** Override the child count used for the ≤7 guidance. */
    fieldCount?: number;
    children: React.ReactNode;
    className?: string;
}
/** A chunk of a form: heading + help text + a field grid. Warns (dev) when it holds more than 7 fields. */
export declare const FormSection: React.FC<FormSectionProps>;
