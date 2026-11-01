import React from 'react';
export type TimelineTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export interface TimelineItem {
    id: string;
    /** Icon inside the marker (defaults to a dot). */
    icon?: React.ReactNode;
    /** Who did it, e.g. "Priya Nair". */
    actor?: string;
    /** What happened, e.g. "sent invoice INV-2041". */
    title: React.ReactNode;
    /** Longer detail / note. */
    body?: React.ReactNode;
    /** Human display time, e.g. "2h ago". */
    time?: string;
    /** Machine-readable timestamp for <time dateTime>. */
    dateTime?: string;
    tone?: TimelineTone;
}
export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
    items: TimelineItem[];
}
export declare const Timeline: React.FC<TimelineProps>;
