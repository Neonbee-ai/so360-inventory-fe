import React from 'react';
import { type FormFieldSize } from './FormField';
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'defaultValue' | 'onChange' | 'type'> {
    value?: string;
    defaultValue?: string;
    /** Fires on every keystroke with the new text. */
    onChange?: (value: string) => void;
    /** Debounced (see debounceMs); also fires immediately on Enter and on clear (''). */
    onSearch?: (value: string) => void;
    debounceMs?: number;
    onClear?: () => void;
    loading?: boolean;
    /** Keyboard hint shown while empty, e.g. "⌘K". */
    shortcutHint?: string | false;
    size?: FormFieldSize;
    name?: string;
    'data-testid'?: string;
}
export declare const SearchInput: React.ForwardRefExoticComponent<SearchInputProps & React.RefAttributes<HTMLInputElement>>;
