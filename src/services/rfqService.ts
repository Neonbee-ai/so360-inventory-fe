import { inventoryService } from './inventoryService';

export interface RFQLineInput {
    item_id?: string;
    pr_line_id?: string;
    description?: string;
    quantity: number;
    uom?: string;
    target_unit_price?: number;
    required_delivery_date?: string;
    specification?: string;
}

export interface QuotationLineInput {
    rfq_line_id?: string;
    item_id?: string;
    description?: string;
    quantity: number;
    unit_price: number;
    uom?: string;
    discount_percent?: number;
    tax_rate?: number;
    lead_time_days?: number;
    moq?: number;
    brand?: string;
}

/**
 * Request For Quotation client — the sourcing stage between an approved
 * requisition and a purchase order.
 */
class RfqService {
    private readonly baseUrl: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any)?.env || {};
        const resolved =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            env.VITE_API_BASE_URL ||
            'http://localhost:3006';
        this.baseUrl = `${String(resolved).replace(/\/$/, '')}/v1/procurement/rfq`;
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

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'API Request failed' }));
            const rawMsg = errorBody.message;
            const msg = Array.isArray(rawMsg) ? rawMsg.join(', ') : (rawMsg || 'API Request failed');
            throw new Error(msg);
        }

        return response.json();
    }

    async getRFQs(filters: { search?: string; status?: string; limit?: number } = {}) {
        const qs = new URLSearchParams();
        if (filters.search) qs.append('search', filters.search);
        if (filters.status) qs.append('status', filters.status);
        if (filters.limit) qs.append('limit', String(filters.limit));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return this.request(`/list/${inventoryService.getOrgId()}${suffix}`);
    }

    async getRFQ(id: string) {
        return this.request(`/detail/${id}`);
    }

    async createRFQ(dto: Record<string, any>) {
        return this.request('', { method: 'POST', body: JSON.stringify(dto) });
    }

    /** Send to every invited vendor that has not been emailed yet. */
    async sendRFQ(id: string, dto: { vendor_ids?: string[]; message?: string } = {}) {
        return this.request(`/${id}/send`, { method: 'PATCH', body: JSON.stringify(dto) });
    }

    async recordQuotation(rfqId: string, dto: Record<string, any>) {
        return this.request(`/${rfqId}/quotation`, { method: 'POST', body: JSON.stringify(dto) });
    }

    async gradeQuotation(quotationId: string, dto: { status: 'received' | 'shortlisted' | 'rejected'; notes?: string }) {
        return this.request(`/quotation/${quotationId}/status`, { method: 'PATCH', body: JSON.stringify(dto) });
    }

    async declineForVendor(rfqId: string, dto: { vendor_id: string; reason?: string }) {
        return this.request(`/${rfqId}/decline`, { method: 'PATCH', body: JSON.stringify(dto) });
    }

    async getComparison(rfqId: string) {
        return this.request(`/${rfqId}/comparison`);
    }

    /** Awarding creates the purchase order and returns { rfq, po }. */
    async awardRFQ(rfqId: string, dto: { quotation_id: string; justification?: string; po_number?: string }) {
        return this.request(`/${rfqId}/award`, { method: 'PATCH', body: JSON.stringify(dto) });
    }

    async cancelRFQ(rfqId: string, reason?: string) {
        return this.request(`/${rfqId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
    }

    async deleteRFQ(rfqId: string) {
        return this.request(`/${rfqId}`, { method: 'DELETE' });
    }
}

export const rfqService = new RfqService();
