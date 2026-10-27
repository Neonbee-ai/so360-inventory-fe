import React from 'react';
export interface TreeNode {
    id: string;
    label: React.ReactNode;
    /** Plain-text name used for aria-label on checkboxes; defaults to label when it is a string. */
    textLabel?: string;
    icon?: React.ReactNode;
    /** Right-aligned secondary text, e.g. a balance. */
    meta?: React.ReactNode;
    disabled?: boolean;
    children?: TreeNode[];
}
export interface TreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'onSelect' | 'onChange' | 'defaultChecked'> {
    nodes: TreeNode[];
    'aria-label': string;
    expanded?: string[];
    defaultExpanded?: string[];
    onExpandedChange?: (ids: string[]) => void;
    selected?: string | null;
    defaultSelected?: string | null;
    onSelect?: (id: string) => void;
    /** Show checkboxes (parents cascade to children, with mixed state). */
    checkable?: boolean;
    checked?: string[];
    defaultChecked?: string[];
    onCheckedChange?: (ids: string[]) => void;
}
export declare const Tree: React.FC<TreeProps>;
