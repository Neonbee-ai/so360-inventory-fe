import React from 'react';
export interface KpiCardProps {
    label: string;
    value: React.ReactNode;
    /** Signed change; positive = increase, negative = decrease, 0 = no sign announcement. */
    delta?: number;
    deltaLabel?: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    loading?: boolean;
    onClick?: () => void;
    className?: string;
    'data-testid'?: string;
}
export declare const KpiCard: React.FC<KpiCardProps>;
