/**
 * Per-call opt-out: pass `{ suppressToast: true }` in the axios request
 * config. No global axios augmentation is shipped here (design-system's own
 * axios copy would receive it, not the consumer's) — repos that want it typed
 * add a one-line `declare module 'axios'` augmentation locally, or cast.
 *
 * Structural view of the axios pieces we touch. Deliberately NOT typed against
 * axios's own AxiosInstance/AxiosError: design-system carries its own axios
 * copy, so consumers with a different axios version would hit
 * "AxiosInstance is not assignable to AxiosInstance" (two module identities).
 * Any axios v1 instance satisfies this shape.
 */
export interface ToastErrorHandlerClient {
    interceptors: {
        response: {
            use(onFulfilled?: any, onRejected?: (error: any) => any): number;
        };
    };
}
export interface AttachToastErrorHandlerOptions {
    /** Extra HTTP statuses that must never auto-toast (401/402 always skipped). */
    skipStatuses?: number[];
}
/**
 * Baseline error surfacing for an axios client: any failed MUTATION toasts the
 * normalized server message automatically. Reads (GET) never toast — load
 * errors belong inline/in empty states. Per-call opt-out via
 * `{ suppressToast: true }` in the request config. Errors are deduped per
 * method+url+status within a 2s window so a burst (retry, double submit)
 * produces one toast.
 */
export declare function attachToastErrorHandler(instance: ToastErrorHandlerClient, options?: AttachToastErrorHandlerOptions): number;
