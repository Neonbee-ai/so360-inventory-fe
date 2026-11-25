import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

/** Buyer-side supplier portal administration (Pulse 0bf7c806). Endpoints: /v1/vendors/:id/portal-users, /portal-access/:id, /portal-users/:uid/*, /profile-change-requests. */
class VendorPortalAdminService {
    private readonly origin: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any).env || {};
        const resolved = (win && win.VITE_SO360_INVENTORY_API) || env.VITE_SO360_INVENTORY_API || env.VITE_API_BASE_URL || 'http://localhost:3006';
        this.origin = `${String(resolved).replace(/\/$/, '')}/v1`;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`${this.origin}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(inventoryService as any).accessToken}`,
                'X-Tenant-Id': (inventoryService as any).tenantId || '',
                'X-Org-Id': inventoryService.getOrgId() || '',
                ...options.headers,
            },
        });
        await notifyQuotaExceeded(response);
        if (!response.ok) {
            const body = await response.json().catch(() => ({ message: 'API Request failed' }));
            const raw = body.message;
            throw Object.assign(new Error(Array.isArray(raw) ? raw.join(', ') : (raw || 'API Request failed')), { status: response.status, code: body.code });
        }
        return response.json();
    }

    listPortalUsers<T = any>(vendorId: string): Promise<T> {
        return this.request(`/vendors/${vendorId}/portal-users`);
    }

    invite(vendorId: string, body: { email: string; full_name?: string; roles: string[] }) {
        return this.request(`/vendors/${vendorId}/portal-users`, { method: 'POST', body: JSON.stringify(body) });
    }

    updateRoles(accessId: string, roles: string[]) {
        return this.request(`/vendors/portal-access/${accessId}`, { method: 'PATCH', body: JSON.stringify({ roles }) });
    }

    revokeAccess(accessId: string, reason: string) {
        return this.request(`/vendors/portal-access/${accessId}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    }

    deactivateUser(portalUserId: string, reason: string) {
        return this.request(`/vendors/portal-users/${portalUserId}/deactivate`, { method: 'POST', body: JSON.stringify({ reason }) });
    }

    revokeSessions(portalUserId: string) {
        return this.request(`/vendors/portal-users/${portalUserId}/revoke-sessions`, { method: 'POST', body: '{}' });
    }

    listChangeRequests<T = any>(params: { status?: string; vendor_id?: string } = {}): Promise<T> {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        if (params.vendor_id) q.set('vendor_id', params.vendor_id);
        const qs = q.toString();
        return this.request(`/vendors/profile-change-requests${qs ? `?${qs}` : ''}`);
    }

    getChangeRequest<T = any>(id: string): Promise<T> {
        return this.request(`/vendors/profile-change-requests/${id}`);
    }

    decideChangeRequest(id: string, decision: 'approve' | 'reject', note?: string) {
        return this.request(`/vendors/profile-change-requests/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, note }) });
    }

    listAccessReviews<T = any>(): Promise<T> {
        return this.request('/vendors/portal-access-reviews');
    }

    decideAccessReview(accessId: string, decision: 'keep' | 'revoke', note?: string) {
        return this.request(`/vendors/portal-access-reviews/${accessId}`, { method: 'POST', body: JSON.stringify({ decision, note }) });
    }
}

export const vendorPortalAdminService = new VendorPortalAdminService();
