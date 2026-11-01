import React from 'react';
export interface TagInputProps {
    value?: string[];
    defaultValue?: string[];
    onChange?: (tags: string[]) => void;
    /** Return an error message to reject a tag, or null/undefined to accept. */
    validate?: (tag: string) => string | null | undefined;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
    maxTags?: number;
    /** Allow the same tag twice (default false, compared case-insensitively). */
    allowDuplicates?: boolean;
    /** Add the pending text when the input loses focus (default true). */
    addOnBlur?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Type tags and press Enter or comma to add; Backspace on empty input removes the last tag. */
export declare const TagInput: React.FC<TagInputProps>;
