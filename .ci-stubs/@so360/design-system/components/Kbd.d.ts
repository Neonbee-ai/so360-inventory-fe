import React from 'react';
export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
    /** Keys for a combo, e.g. ['⌘', 'K']. Takes precedence over children. */
    keys?: string[];
    size?: 'sm' | 'md';
}
export declare const Kbd: React.FC<KbdProps>;
