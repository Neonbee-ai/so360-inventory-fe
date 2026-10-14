import React from 'react';
export type BannerVariant = 'info' | 'success' | 'warning' | 'danger';
export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    variant?: BannerVariant;
    title?: React.ReactNode;
    dismissible?: boolean;
    onDismiss?: () => void;
    action?: {
        label: string;
        onClick: () => void;
    };
}
export declare const Banner: React.FC<BannerProps>;
