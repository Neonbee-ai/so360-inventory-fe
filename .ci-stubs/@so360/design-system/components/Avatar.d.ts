import React from 'react';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';
export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
    /** Image URL; falls back to initials when missing or broken. */
    src?: string;
    /** Person / entity name — used for initials and the accessible label. */
    name?: string;
    size?: AvatarSize;
    status?: AvatarStatus;
}
export declare const getInitials: (name?: string) => string;
export declare const Avatar: React.FC<AvatarProps>;
