import React from 'react';
import { AvatarProps, AvatarSize } from './Avatar';
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    avatars: AvatarProps[];
    /** Max avatars shown before collapsing into "+N". */
    max?: number;
    size?: AvatarSize;
}
export declare const AvatarGroup: React.FC<AvatarGroupProps>;
