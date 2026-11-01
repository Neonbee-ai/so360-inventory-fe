import React from 'react';
export interface EmptyStateProps {
    icon?: React.ComponentType<{
        className?: string;
    }>;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    /** Used for the testid instead of the title. */
    name?: string;
    className?: string;
    'data-testid'?: string;
}
export declare const EmptyState: React.FC<EmptyStateProps>;
