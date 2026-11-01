import React from 'react';
export type SparklineType = 'line' | 'area' | 'bar';
export type SparklineTone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
export interface SparklineProps {
    data: number[];
    type?: SparklineType;
    tone?: SparklineTone;
    width?: number;
    height?: number;
    strokeWidth?: number;
    /** Accessible description; defaults to a min/max/last summary. */
    label?: string;
    /** Marks the last data point with a dot (line/area). */
    showLastPoint?: boolean;
    className?: string;
    'data-testid'?: string;
}
/** Dependency-free inline SVG trend chart (line / area / bar). */
export declare const Sparkline: React.FC<SparklineProps>;
