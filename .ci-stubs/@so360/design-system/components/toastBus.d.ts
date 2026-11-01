export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
export interface ToastAction {
    label: string;
    onClick: () => void;
}
export interface ToastReply {
    placeholder?: string;
    /** Rejecting leaves the toast open with an inline error so the draft isn't lost. */
    onSubmit: (text: string) => Promise<void> | void;
}
export interface ToastOptions {
    /** Bold first line; `message` becomes the body text below it. */
    title?: string;
    /** Auto-dismiss delay in ms. Defaults: success/info 4000, warning 5000, error 6000. */
    duration?: number;
    /** Never auto-dismiss — manual ✕ only. */
    sticky?: boolean;
    /** Dedupe key — a toast with the same id replaces the existing one instead of stacking. */
    id?: string;
    action?: ToastAction;
    /** Shows an inline reply box instead of (or alongside) the action button. */
    reply?: ToastReply;
}
export interface ToastRecord {
    id: string;
    variant: ToastVariant;
    message: string;
    title?: string;
    duration: number;
    sticky: boolean;
    action?: ToastAction;
    reply?: ToastReply;
}
export interface ToastPromiseMessages<T> {
    loading?: string;
    success: string | ((value: T) => string);
    error?: string | ((err: unknown) => string);
}
export interface ToastApi {
    success(message: string, opts?: ToastOptions): string;
    error(message: string, opts?: ToastOptions): string;
    warning(message: string, opts?: ToastOptions): string;
    info(message: string, opts?: ToastOptions): string;
    promise<T>(p: Promise<T>, msgs: ToastPromiseMessages<T>): Promise<T>;
    /** Dismiss one toast by id, or all when called without arguments. */
    dismiss(id?: string): void;
}
type Listener = (toasts: ToastRecord[]) => void;
declare class ToastBus {
    private toasts;
    private listeners;
    getToasts(): ToastRecord[];
    subscribe(listener: Listener): () => void;
    show(variant: ToastVariant, message: string, opts?: ToastOptions): string;
    dismiss(id?: string): void;
    private emit;
}
export declare const toastBus: ToastBus;
type BridgedToastApi = ToastApi & {
    __bus?: unknown;
};
declare global {
    interface Window {
        /** Set by the shell's GlobalToaster; MFE-local design-system instances forward here. */
        __so360_toast?: BridgedToastApi;
    }
}
export declare const toast: ToastApi;
export {};
