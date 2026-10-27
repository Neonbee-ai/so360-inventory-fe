import React from 'react';
export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    variant?: 'primary' | 'muted';
    /** Opens in a new tab with a trailing icon and safe rel. */
    external?: boolean;
    /** Always underline (default: on hover). */
    underline?: boolean;
}
export declare const Link: React.FC<LinkProps>;
