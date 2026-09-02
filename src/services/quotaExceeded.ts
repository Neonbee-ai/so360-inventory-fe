import { QUOTA_EXCEEDED_EVENT, buildQuotaExceededDetail } from '@so360/shell-context';

/**
 * Fetch-side equivalent of `installQuotaExceededInterceptor` from
 * `@so360/shell-context`: this MFE talks to its backend with `fetch`, not
 * axios, so every response helper calls this right after `fetch(...)`.
 *
 * A 402 is surfaced to the Shell's QuotaExceededModal via the shared
 * `__so360_quota_exceeded` event (detail = `data.resolution ?? data`, exactly
 * like the axios interceptor). The body is read from a clone so the caller can
 * still consume the response and throw its own error.
 */
export async function notifyQuotaExceeded(response: Response): Promise<void> {
    if (response.status !== 402 || typeof window === 'undefined') return;
    let data: unknown = {};
    try { data = await response.clone().json(); } catch { data = {}; }
    window.dispatchEvent(new CustomEvent(QUOTA_EXCEEDED_EVENT, {
        detail: buildQuotaExceededDetail({ response: { status: 402, data } }),
    }));
}
