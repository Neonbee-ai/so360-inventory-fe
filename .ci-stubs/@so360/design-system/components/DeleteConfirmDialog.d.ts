import React from 'react';
export interface DeleteConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    entityName?: string;
    entityType?: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    variant?: 'danger' | 'warning';
}
export declare const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps>;
