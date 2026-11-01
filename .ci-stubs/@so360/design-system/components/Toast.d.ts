import React from 'react';
import { type ToastApi } from './toastBus';
/**
 * The single on-screen toast queue. Mount exactly ONE per window — the shell's
 * GlobalToaster in the MFE platform, or a ToastProvider in standalone apps.
 * Renders the newest toast on top, capped at 4 visible (older ones stay queued
 * in the bus and appear as visible slots free up).
 */
export declare const ToastViewport: React.FC;
export interface ToastProviderProps {
    children?: React.ReactNode;
}
/**
 * For standalone (non-MFE) apps: mounts the viewport and claims the window
 * bridge so any design-system instance in the page reaches this queue.
 * MFE remotes must NOT mount this — the shell's GlobalToaster owns the queue.
 */
export declare const ToastProvider: React.FC<ToastProviderProps>;
export declare function useToast(): ToastApi;
