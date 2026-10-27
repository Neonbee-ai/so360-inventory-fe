import React from 'react';
import { SparklineType } from './Sparkline';
export interface StatCardProps {
    label: string;
    value: React.ReactNode;
    /** Percentage change vs the previous period (e.g. 12.5 = +12.5%). */
    delta?: number;
    /** Text after the delta, e.g. "vs last month". */
    deltaLabel?: string;
    /** Costs/overdue: when true a decrease is shown as good (success) and an increase as bad. */
    invertDelta?: boolean;
    /** Period caption shown under the label, e.g. "Last 30 days". */
    period?: string;
    /** Trend series rendered as a Sparkline. */
    data?: number[];
    sparklineType?: SparklineType;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    loading?: boolean;
    className?: string;
    'data-testid'?: string;
}
export declare const StatCard: React.FC<StatCardProps>;
