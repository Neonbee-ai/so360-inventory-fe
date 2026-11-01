import React from 'react';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export interface CardProps {
    title?: string;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    padding?: CardPadding;
    /** Used for the testid when there is no title. */
    name?: string;
    children?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
}
export declare const Card: React.FC<CardProps>;
