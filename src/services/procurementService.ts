import { inventoryService } from './inventoryService';

class ProcurementService {
    private readonly origin: string;
    private readonly baseUrl: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any)?.env || {};
        const resolved =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            env.VITE_API_BASE_URL ||
            'http://localhost:3006';
        this.origin = String(resolved).replace(/\/$/, '');
        this.baseUrl = `${this.origin}/v1/procurement`;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const orgId = inventoryService.getOrgId();
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(inventoryService as any).accessToken}`,
                'X-Tenant-Id': (inventoryService as any).tenantId || '',
                'X-Org-Id': orgId || '',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'API Request failed' }));
            throw new Error(error.message || 'API Request failed');
        }

        return response.json();
    }

    // Purchase Requisitions
    async getPRs() {
        return this.request(`/pr/${inventoryService.getOrgId()}`);
    }

    async createPR(dto: any) {
        return this.request('/pr', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getPRDetail(id: string) {
        return this.request(`/pr/detail/${id}`);
    }

    async approvePR(id: string, approvalDto: any) {
        return this.request(`/pr/${id}/approve`, {
            method: 'PATCH',
            body: JSON.stringify(approvalDto),
        });
    }

    async getConversionPayload(prId: string) {
        return this.request(`/pr/${prId}/convert-to-po`, { method: 'POST' });
    }

    async closePR(prId: string) {
        return this.request(`/pr/${prId}/close`, { method: 'PATCH' });
    }

    async deletePR(prId: string) {
        return this.request(`/pr/${prId}`, { method: 'DELETE' });
    }

    // Purchase Orders
    async getPOs() {
        return this.request(`/po/${inventoryService.getOrgId()}`);
    }

    async createPO(dto: any) {
        return this.request('/po', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getPODetail(id: string) {
        return this.request(`/po/detail/${id}`);
    }

    async updatePOStatus(id: string, dto: { status: string; reason?: string }) {
        return this.request(`/po/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    // Goods Receipt
    async createGRN(dto: any) {
        return this.request('/grn', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getGRNs() {
        return this.request(`/grn/${inventoryService.getOrgId()}`);
    }

    async getGRNDetail(id: string) {
        return this.request(`/grn/detail/${id}`);
    }

    // Vendor Invoices
    async createVendorInvoice(dto: {
        vendor_id: string;
        invoice_number: string;
        invoice_date: string;
        due_date?: string;
        total_amount: number;
        po_id?: string;
        attachment_url?: string;
    }) {
        return this.request('/vendor-invoice', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    // Analytics
    async getAnalytics() {
        return this.request(`/analytics/${inventoryService.getOrgId()}`);
    }

    // Opening Balance
    async createOpeningBalance(dto: {
        vendor_id?: string;
        vendor_name?: string;
        po_number?: string;
        grn_number?: string;
        effective_date?: string;
        note?: string;
        items: Array<{ item_id: string; warehouse_id: string; quantity: number; unit_cost: number }>;
    }) {
        return this.request('/opening-balance', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getUnlinkedMovements() {
        return this.request(`/unlinked-movements/${inventoryService.getOrgId()}`);
    }
}

export const procurementService = new ProcurementService();
