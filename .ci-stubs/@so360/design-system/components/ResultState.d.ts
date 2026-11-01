import React from 'react';
import { LucideIcon } from 'lucide-react';
export type ResultStatus = 'success' | 'error' | 'info';
export interface ResultStateProps {
    status: ResultStatus;
    title: string;
    description?: string;
    /** Peak-end: always offer the obvious next step. */
    primaryAction?: React.ReactNode;
    secondaryAction?: React.ReactNode;
    /** Override the default status icon. */
    icon?: LucideIcon;
    className?: string;
}
/** Outcome screen (success / error / info): icon, title, description, one primary + one secondary action. */
export declare const ResultState: React.FC<ResultStateProps>;
