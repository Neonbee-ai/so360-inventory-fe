import React from 'react';
import { MenuItem } from './Menu';
export interface SplitButtonProps {
    /** Primary action label. */
    label: React.ReactNode;
    onClick: () => void;
    /** Secondary actions shown in the dropdown. */
    items: MenuItem[];
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    /** Accessible name for the dropdown toggle. */
    menuLabel?: string;
    className?: string;
}
export declare const SplitButton: React.FC<SplitButtonProps>;
