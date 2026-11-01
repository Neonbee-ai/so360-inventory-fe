import React from 'react';
export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    group?: string;
    /** Display-only shortcut hint, e.g. "G then D" or "Ctrl+N". */
    shortcut?: string;
    /** Extra search terms that are matched but not displayed. */
    keywords?: string[];
    icon?: React.ComponentType<{
        className?: string;
    }>;
    disabled?: boolean;
    onSelect?: () => void;
}
export interface CommandPaletteProps {
    commands: CommandItem[];
    /** Controlled open state. */
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Called after a command runs (palette closes first). */
    onRun?: (command: CommandItem) => void;
    placeholder?: string;
    emptyText?: string;
    /** Listen for Ctrl/Cmd+K to toggle the palette (default true). */
    hotkey?: boolean;
    name?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare const CommandPalette: React.FC<CommandPaletteProps>;
