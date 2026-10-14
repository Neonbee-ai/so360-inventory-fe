import React from 'react';
import { BadgeSize, BadgeTone } from './Badge';
export declare const DEFAULT_STATUS_MAP: Record<string, BadgeTone>;
export interface StatusBadgeProps {
    status: string;
    /** Overrides/extends the default map. Keys are matched case-insensitively. */
    map?: Record<string, BadgeTone>;
    size?: BadgeSize;
    className?: string;
    'data-testid'?: string;
}
export declare function titleCase(value: string): string;
export declare const StatusBadge: React.FC<StatusBadgeProps>;
