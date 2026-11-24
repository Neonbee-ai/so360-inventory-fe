import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export const EXPECTED_RECEIPTS_FLAG = 'submodule:inventory:procurement_expected_receipts';
export const DIRECT_TO_SITE_FLAG = 'action:inventory:procurement:direct_to_site_receipt';
export const SERVICE_ACCEPTANCE_FLAG = 'action:inventory:procurement:service_acceptance';
export const SUPPLIER_CLAIMS_FLAG = 'submodule:inventory:procurement_supplier_claims';

export type ClaimType = 'return' | 'replacement' | 'repair' | 'rework' | 'credit' | 'debit' | 'price_concession' | 'accept_as_is';

export interface ClaimUpdate {
    claim_type?: ClaimType;
    owner_id?: string;
    supplier_response?: string;
    rma_number?: string;
    replacement_eta?: string;
    physical_done?: boolean;
    quality_done?: boolean;
    commercial_done?: boolean;
    credit_note_number?: string;
    credit_note_date?: string;
    replacement_grn_id?: string;
    evidence?: Array<{ type?: string; name?: string; url?: string; note?: string }>;
}

export interface QuarantineDisposition {
    lines: Array<{ line_id: string; decision: 'release' | 'reject' | 'use_as_is'; quantity: number; note?: string }>;
}

/** Expected receipts, quarantine disposition and supplier claims (Procurement Flow 07, Pulse 4fe6cf16). */
class ReceivingService {
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

    expectedReceipts(filters: { status?: string; warehouse_id?: string; from?: string; to?: string; po_id?: string } = {}) {
        const qs = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
        return this.request(`/expected-receipts/${inventoryService.getOrgId()}${qs ? `?${qs}` : ''}`);
    }
    expectedReceipt(id: string) { return this.request(`/expected-receipts/detail/${id}`); }
    updateClaim(returnId: string, dto: ClaimUpdate) {
        return this.request(`/returns/${returnId}/claim`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    dispositionInspection(inspectionId: string, dto: QuarantineDisposition) {
        return this.request(`/quality/${inspectionId}/disposition`, { method: 'POST', body: JSON.stringify(dto) });
    }
    dispositionReceiptLines(dto: QuarantineDisposition) {
        return this.request('/receipts/quarantine-disposition', { method: 'POST', body: JSON.stringify(dto) });
    }
}

export const receivingService = new ReceivingService();
