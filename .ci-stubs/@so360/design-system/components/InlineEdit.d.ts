import React from 'react';
export interface InlineEditProps {
    value?: string;
    defaultValue?: string;
    /** Called with the trimmed new value. May be async; a rejection keeps the editor open and shows the error. */
    onSave?: (value: string) => void | Promise<void>;
    onCancel?: () => void;
    /** Return an error message to block saving, or null/undefined when valid. */
    validate?: (value: string) => string | null | undefined;
    /** Accessible name of the field, e.g. "Customer name". */
    label: string;
    placeholder?: string;
    /** Shown in read mode when the value is empty. */
    emptyText?: string;
    disabled?: boolean;
    /** Commit when focus leaves the editor (default: stay open). */
    saveOnBlur?: boolean;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
export declare const InlineEdit: React.FC<InlineEditProps>;
