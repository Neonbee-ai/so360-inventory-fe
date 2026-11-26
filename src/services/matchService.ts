import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export const MATCH_WORKBENCH_FLAG = 'submodule:inventory:procurement_match_workbench';
export const FINANCE_OWNED_AP_FLAG = 'action:inventory:procurement:finance_owned_ap';
export const CLOSEOUT_FLAG = 'action:inventory:procurement:po_closeout_control';
export const SUPPLIER_PERFORMANCE_FLAG = 'submodule:inventory:supplier_performance_v2';
export const RECONCILIATION_FLAG = 'submodule:inventory:procurement_reconciliation';

export type ExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'waived' | 'escalated';

export interface ExceptionUpdate {
    status?: ExceptionStatus;
    owner_id?: string | null;
    resolution_note?: string;
    evidence?: Array<{ type?: string; name?: string; url?: string; note?: string }>;
}

/** Invoice match workbench, PO closeout and reconciliation client (Procurement Flow 08, Pulse 559f6d73). */
class MatchService {
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

    cases(filters: { status?: string; owner_module?: string; vendor_id?: string; po_id?: string } = {}) {
        const qs = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
        return this.request(`/match-cases/${inventoryService.getOrgId()}${qs ? `?${qs}` : ''}`);
    }
    caseDetail(id: string) { return this.request(`/match-cases/detail/${id}`); }
    reevaluate(id: string) { return this.request(`/match-cases/${id}/reevaluate`, { method: 'POST' }); }
    updateException(id: string, dto: ExceptionUpdate, asFinance = false) {
        return this.request(`/match-exceptions/${id}${asFinance ? '/finance' : ''}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    tolerances() { return this.request('/match-tolerances'); }
    putTolerance(dto: { legal_entity_id?: string | null; qty_pct: number; price_pct: number; amount_abs: number; amount_pct: number; tax_abs: number }) {
        return this.request('/match-tolerances', { method: 'PUT', body: JSON.stringify(dto) });
    }

    // PO closeout (08b)
    closeoutCheck(poId: string) { return this.request(`/po/${poId}/closeout-check`); }
    closePo(poId: string, dto: { reason?: string }) { return this.request(`/po/${poId}/close`, { method: 'POST', body: JSON.stringify(dto) }); }
    cancelResidual(poId: string, dto: { reason: string; supplier_communication_ref: string }) {
        return this.request(`/po/${poId}/residual-cancel`, { method: 'POST', body: JSON.stringify(dto) });
    }

    // Supplier performance + reconciliation (08c)
    supplierPerformance(filters: { period?: string; segment?: string; category_id?: string; site_id?: string } = {}) {
        const qs = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
        return this.request(`/insights/supplier-performance/${inventoryService.getOrgId()}${qs ? `?${qs}` : ''}`);
    }
    reconciliationIssues(filters: { status?: string; kind?: string } = {}) {
        const qs = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
        return this.request(`/reconciliation-issues${qs ? `?${qs}` : ''}`);
    }
    updateIssue(id: string, dto: { status?: string; owner_id?: string | null; note?: string }) {
        return this.request(`/reconciliation-issues/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
}

export const matchService = new MatchService();
