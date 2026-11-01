import React from 'react';
export interface DividerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
    orientation?: 'horizontal' | 'vertical';
    /** Optional centred label (horizontal only). */
    label?: React.ReactNode;
    /** Purely visual — removes the separator role. */
    decorative?: boolean;
}
export declare const Divider: React.FC<DividerProps>;
