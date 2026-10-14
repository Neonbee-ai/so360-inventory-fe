import React from 'react';
export interface NotificationItem {
    id: string;
    title: string;
    description?: string;
    /** Pre-formatted time, e.g. "5m ago". */
    time: string;
    read: boolean;
}
export interface NotificationCenterProps {
    notifications: NotificationItem[];
    onMarkRead?: (id: string) => void;
    onMarkAllRead?: () => void;
    /** Fired when a notification is activated (also marks it read via onMarkRead if unread). */
    onSelect?: (notification: NotificationItem) => void;
    emptyText?: string;
    /** Bell button accessible base name. */
    label?: string;
    className?: string;
    'data-testid'?: string;
}
/** Bell with unread count and a panel listing notifications. */
export declare const NotificationCenter: React.FC<NotificationCenterProps>;
