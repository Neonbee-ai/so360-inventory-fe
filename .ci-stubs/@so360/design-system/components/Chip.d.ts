import React from 'react';
export interface ChipAvatar {
    name: string;
    src?: string;
}
export interface ChipProps {
    children: React.ReactNode;
    /** Selected visual + aria-pressed (only meaningful when selectable). */
    selected?: boolean;
    /** Makes the chip a toggle button. Receives the next selected state. */
    onSelectedChange?: (selected: boolean) => void;
    /** Makes the chip a plain button (no toggle semantics unless `selected` is set). */
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    /** Shows a remove (x) button; Backspace/Delete on the chip also removes. */
    onRemove?: () => void;
    removeLabel?: string;
    avatar?: ChipAvatar;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    size?: 'sm' | 'md';
    disabled?: boolean;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
export declare const Chip: React.FC<ChipProps>;
