import React from 'react';
import { Modal as CombModal } from '@so360/design-system';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

/** Thin wrapper over the Comb Modal; keeps the legacy `isOpen` prop API. */
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => ( // comb-exception: thin legacy-API wrapper over the DS Modal, not a reimplementation
    <CombModal open={isOpen} onClose={onClose} title={title} size={size === 'lg' ? '2xl' : size === 'xl' ? '4xl' : size}>
        {children}
    </CombModal>
);
