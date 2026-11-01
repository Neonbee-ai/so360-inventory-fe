import React from 'react';
export interface User {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role: string;
}
export interface UserSelectorProps {
    /** A single id, or an array when `multiSelect` is on. */
    value?: string | string[];
    onChange: (userId: string | string[] | null, user?: User | User[]) => void;
    /**
     * Pick several users instead of one. The dropdown stays open while picking,
     * because choosing five people one reopen at a time is its own punishment.
     */
    multiSelect?: boolean;
    orgId: string;
    tenantId?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    excludeUserIds?: string[];
}
export declare const UserSelector: React.FC<UserSelectorProps>;
