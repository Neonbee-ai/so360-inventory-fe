import React from 'react';
export type AlertVariant = 'info' | 'success' | 'warning' | 'error';
export interface AlertAction {
    label: string;
    onClick: () => void;
}
export interface AlertProps {
    variant?: AlertVariant;
    /** Short uppercase eyebrow above the body. Omit for a single-line alert. */
    title?: string;
    children?: React.ReactNode;
    /** Override the variant's default icon, or pass `false` to omit it entirely. */
    icon?: React.ComponentType<{
        className?: string;
    }> | false;
    /**
     * At most ONE action. Deliberately singular: an alert competing for attention
     * with two equal buttons stops being a clear next step.
     */
    action?: AlertAction;
    onDismiss?: () => void;
    className?: string;
    id?: string;
}
export declare const Alert: React.FC<AlertProps>;
