import React from 'react';
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'horizontal' | 'vertical';
    /** Required accessible name. */
    'aria-label': string;
}
/** role=toolbar with roving tabindex across enabled buttons (arrows / Home / End). */
export declare const Toolbar: React.FC<ToolbarProps>;
export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Toggle state (renders aria-pressed). */
    pressed?: boolean;
}
export declare const ToolbarButton: React.FC<ToolbarButtonProps>;
export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    'aria-label'?: string;
}
export declare const ToolbarGroup: React.FC<ToolbarGroupProps>;
export declare const ToolbarSeparator: React.FC<{
    orientation?: 'horizontal' | 'vertical';
}>;
