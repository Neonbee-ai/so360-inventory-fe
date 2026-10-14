import React from 'react';
/**
 * Mirror of `QUOTA_EXCEEDED_EVENT` in @so360/shell-context. The design system
 * must not depend on shell-context, so the name is duplicated here on purpose —
 * the Shell's QuotaExceededModal listens for it and owns the upgrade path.
 */
export declare const QUOTA_EXCEEDED_EVENT = "__so360_quota_exceeded";
export interface QuotaGateProps {
    quotaKey: string;
    moduleCode: string;
    used: number;
    limit: number;
    isUnlimited?: boolean;
    disableOnExceeded?: boolean;
    fallback?: React.ReactNode;
    /** Override the upgrade action (defaults: cross-link navigate, else the shell quota event). */
    onUpgrade?: () => void;
    children: React.ReactNode;
}
export declare const QuotaGate: React.FC<QuotaGateProps>;
