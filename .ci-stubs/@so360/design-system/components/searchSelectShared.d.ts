import React from 'react';
/** Internal helpers shared by the Batch B search / selection / entry components. Not part of the public API. */
/** Wrap the first case-insensitive occurrence of `query` in `text` with a highlight. */
export declare function highlightMatch(text: string, query: string): React.ReactNode;
/** Lower is better; null = no match. Substring beats subsequence; prefix beats mid-string. */
export declare function fuzzyScore(query: string, text: string): number | null;
/** Stable reorder so items of the same group are contiguous (groups keep first-seen order). */
export declare function orderByGroup<T extends {
    group?: string;
}>(items: T[]): T[];
export declare function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number): {
    call: (...args: A) => void;
    cancel: () => void;
};
export declare const Kbd: React.FC<{
    children: React.ReactNode;
    className?: string;
}>;
export interface FieldShellProps {
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}
/** Wraps a control in FormField when a label is given; otherwise renders hint/error inline. */
export declare const FieldShell: React.FC<FieldShellProps>;
export interface ListRow<T = unknown> {
    /** DOM id (used for aria-activedescendant). */
    id: string;
    label: string;
    description?: string;
    group?: string;
    disabled?: boolean;
    selected?: boolean;
    /** Show a checkbox-style mark (multi-select). */
    checkbox?: boolean;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    /** Query used to highlight the matching label text. */
    query?: string;
    data: T;
}
export interface OptionListProps<T> {
    rows: ListRow<T>[];
    activeId?: string | null;
    listboxId: string;
    label: string;
    multiselectable?: boolean;
    onPick: (row: ListRow<T>) => void;
    onActive?: (id: string) => void;
    className?: string;
}
export declare function OptionList<T>({ rows, activeId, listboxId, label, multiselectable, onPick, onActive, className, }: OptionListProps<T>): React.JSX.Element;
