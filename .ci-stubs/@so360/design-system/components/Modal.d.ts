import React from 'react';
export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    footer?: React.ReactNode;
    children?: React.ReactNode;
    /** Click on the backdrop closes the modal. Default true. */
    closeOnOverlayClick?: boolean;
    /** Element to focus on open; defaults to the first focusable control. */
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    /** Used for the derived test id (falls back to title). */
    name?: string;
    'data-testid'?: string;
}
/**
 * Centered, portaled dialog with focus trap, Esc-to-close, focus restore and
 * body scroll lock. Prefer Drawer for create/edit flows; use Modal for short
 * decisions and confirmations.
 */
export declare const Modal: React.FC<ModalProps>;
