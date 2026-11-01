import React from 'react';
export interface QuotaBarProps {
    label: string;
    icon?: React.ReactNode;
    used: number;
    limit: number;
    unit?: string;
    isUnlimited?: boolean;
    showBuyMore?: boolean;
    onBuyMore?: () => void;
    className?: string;
}
export declare const QuotaBar: React.FC<QuotaBarProps>;
