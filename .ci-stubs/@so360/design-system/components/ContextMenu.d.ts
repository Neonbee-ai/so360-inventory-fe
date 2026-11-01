import React from 'react';
export interface ContextMenuItem {
    label: string;
    onSelect?: () => void;
    icon?: React.ReactNode;
    /** Right-aligned hint such as "⌘C". Purely visual. */
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    /** Nested items turn this entry into a submenu opener. */
    items?: ContextMenuEntry[];
}
export interface ContextMenuSeparator {
    separator: true;
}
export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;
export interface ContextMenuProps {
    items: ContextMenuEntry[];
    /** Region that opens the menu on right-click (or Shift+F10 / the Menu key). */
    children: React.ReactNode;
    disabled?: boolean;
    /** Accessible name of the menu. */
    label?: string;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/** Right-click menu with roving keyboard focus and optional submenus. */
export declare const ContextMenu: React.FC<ContextMenuProps>;
