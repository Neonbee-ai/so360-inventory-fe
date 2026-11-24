import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export const SCORECARDS_FLAG = 'submodule:inventory:vendor_scorecards';
export const GOVERNANCE_FLAG = 'submodule:inventory:vendor_governance_analytics';
export const ADJUST_FLAG = 'action:inventory:vendor_score_adjust';
export const DISPUTE_FLAG = 'action:inventory:vendor_fact_dispute';

/** Vendor 18 (Pulse f0dace0a): scorecards, definitions, risk signals, disputes, governance widgets. */
class VendorScorecardService {
    private readonly origin: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any).env || {};
        const resolved = (win && win.VITE_SO360_INVENTORY_API) || env.VITE_SO360_INVENTORY_API || env.VITE_API_BASE_URL || 'http://localhost:3006';
        this.origin = `${String(resolved).replace(/\/$/, '')}/v1/vendors`;
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
            throw Object.assign(new Error(Array.isArray(raw) ? raw.join(', ') : (raw || 'API Request failed')), { status: response.status, body });
        }
        return response.json();
    }

    scorecard(vendorId: string) { return this.request(`/${vendorId}/scorecard`); }
    definitions() { return this.request('/scorecard-definitions'); }
    createDefinition(dto: Record<string, unknown>) { return this.request('/scorecard-definitions', { method: 'POST', body: JSON.stringify(dto) }); }
    updateDefinition(id: string, dto: Record<string, unknown>) { return this.request(`/scorecard-definitions/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }); }
    activateDefinition(id: string) { return this.request(`/scorecard-definitions/${id}/activate`, { method: 'POST' }); }
    riskSignals(params: { status?: string; vendor_id?: string } = {}) {
        const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
        return this.request(`/risk-signals${qs ? `?${qs}` : ''}`);
    }
    setRiskSignalStatus(id: string, status: 'actioned' | 'dismissed') { return this.request(`/risk-signals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
    widget(name: string) { return this.request(`/analytics/${name}`); }
    reconciliationRuns() { return this.request('/reconciliation-runs'); }
    disputeFact(factId: string, dto: { reason: string; proposed_attribution?: string }) { return this.request(`/outcomes/${factId}/disputes`, { method: 'POST', body: JSON.stringify(dto) }); }
}

export const vendorScorecardService = new VendorScorecardService();
