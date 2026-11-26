import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export const PO_APPROVAL_FLAG = 'action:inventory:procurement:po_approval';
export const PO_AMEND_FLAG = 'action:inventory:procurement:po_amend';

/** PO approval, issue, amendment, versions and approval policies (Procurement Flow 05, Pulse 5de6ad46). */
class PoApprovalService {
    private readonly baseUrl: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any).env || {};
        const resolved = (win && win.VITE_SO360_INVENTORY_API) || env.VITE_SO360_INVENTORY_API || env.VITE_API_BASE_URL || 'http://localhost:3006';
        this.baseUrl = `${String(resolved).replace(/\/$/, '')}/v1/procurement`;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
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
            throw new Error(Array.isArray(raw) ? raw.join(', ') : (raw || 'API Request failed'));
        }
        return response.json();
    }

    getApproval(poId: string) { return this.request(`/po/${poId}/approval`); }
    submit(poId: string, dto: { emergency?: boolean } = {}) { return this.request(`/po/${poId}/submit`, { method: 'POST', body: JSON.stringify(dto) }); }
    decide(poId: string, dto: { decision: 'approve' | 'reject' | 'return' | 'clarify'; reason?: string }) { return this.request(`/po/${poId}/approval-decision`, { method: 'POST', body: JSON.stringify(dto) }); }
    issue(poId: string) { return this.request(`/po/${poId}/issue`, { method: 'POST' }); }
    amend(poId: string, dto: { reason: string; header?: Record<string, any>; lines?: Array<{ id: string; quantity?: number; unit_price?: number }> }) { return this.request(`/po/${poId}/amend`, { method: 'POST', body: JSON.stringify(dto) }); }
    versions(poId: string) { return this.request(`/po/${poId}/versions`); }
    cancel(poId: string, reason: string) { return this.request(`/po/${poId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }); }

    listPolicies() { return this.request('/approval-policies'); }
    createPolicy(dto: { name: string; rules: Record<string, any> }) { return this.request('/approval-policies', { method: 'POST', body: JSON.stringify(dto) }); }
    updatePolicy(id: string, dto: Record<string, any>) { return this.request(`/approval-policies/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }); }
    listDelegations() { return this.request('/approval-delegations'); }
    createDelegation(dto: { delegate_id: string; valid_from: string; valid_to: string }) { return this.request('/approval-delegations', { method: 'POST', body: JSON.stringify(dto) }); }
}

export const poApprovalService = new PoApprovalService();
