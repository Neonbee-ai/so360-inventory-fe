import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export interface InspectionResultLine {
    line_id: string;
    accepted_quantity: number;
    rejected_quantity?: number;
    defect_code?: string;
    rejection_reason?: string;
    remarks?: string;
}

export interface ReturnLineInput {
    grn_line_id?: string;
    po_line_id?: string;
    item_id?: string;
    description?: string;
    quantity: number;
    uom?: string;
    unit_cost?: number;
    batch_number?: string;
    reason?: string;
    already_excluded_from_stock?: boolean;
}

/**
 * Quality inspection and vendor returns client.
 *
 * Both live under /v1/procurement, so this shares the procurement base URL
 * rather than introducing another origin.
 */
class QualityService {
    private readonly baseUrl: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        // Bare `import.meta.env` — see procurementService for why the
        // optional-chained form silently ships localhost.
        const env = (import.meta as any).env || {};
        const resolved =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            env.VITE_API_BASE_URL ||
            'http://localhost:3006';
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
            const errorBody = await response.json().catch(() => ({ message: 'API Request failed' }));
            const rawMsg = errorBody.message;
            const msg = Array.isArray(rawMsg) ? rawMsg.join(', ') : (rawMsg || 'API Request failed');
            throw new Error(msg);
        }

        return response.json();
    }

    // ─── Quality inspections ───────────────────────────────────────

    async getInspections(filters: { status?: string; search?: string; limit?: number } = {}) {
        const qs = new URLSearchParams();
        if (filters.status) qs.append('status', filters.status);
        if (filters.search) qs.append('search', filters.search);
        if (filters.limit) qs.append('limit', String(filters.limit));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return this.request(`/quality/list/${inventoryService.getOrgId()}${suffix}`);
    }

    async getInspection(id: string) {
        return this.request(`/quality/detail/${id}`);
    }

    async createInspection(dto: { grn_id: string; sampling_method?: string; sample_size?: number; remarks?: string }) {
        return this.request('/quality', { method: 'POST', body: JSON.stringify(dto) });
    }

    /** Recording the result releases the accepted stock. */
    async completeInspection(id: string, dto: { lines: InspectionResultLine[]; remarks?: string }) {
        return this.request(`/quality/${id}/complete`, { method: 'PATCH', body: JSON.stringify(dto) });
    }

    async cancelInspection(id: string, reason?: string) {
        return this.request(`/quality/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
    }

    // ─── Vendor returns ────────────────────────────────────────────

    async getReturns(filters: { status?: string; vendor_id?: string; search?: string; limit?: number } = {}) {
        const qs = new URLSearchParams();
        if (filters.status) qs.append('status', filters.status);
        if (filters.vendor_id) qs.append('vendor_id', filters.vendor_id);
        if (filters.search) qs.append('search', filters.search);
        if (filters.limit) qs.append('limit', String(filters.limit));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return this.request(`/returns/list/${inventoryService.getOrgId()}${suffix}`);
    }

    async getReturn(id: string) {
        return this.request(`/returns/detail/${id}`);
    }

    async createReturn(dto: Record<string, any>) {
        return this.request('/returns', { method: 'POST', body: JSON.stringify(dto) });
    }

    async updateReturnStatus(id: string, dto: Record<string, any>) {
        return this.request(`/returns/${id}/status`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
}

export const qualityService = new QualityService();
