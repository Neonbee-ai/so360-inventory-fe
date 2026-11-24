import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export const VENDOR_COLLAB_FLAG = 'action:inventory:procurement:vendor_collaboration';

export interface EligibleVendor {
    vendor_id: string;
    vendor_name: string | null;
    name?: string | null;
    decision: 'eligible' | 'conditional' | 'ineligible';
    reason_codes: string[];
    explanation?: string;
    is_preferred?: boolean;
}

export interface EligibilityScope {
    module?: string;
    action: string;
    item_id?: string;
    category_id?: string;
    territory?: string;
    required_date?: string;
}

/** Vendor 08 (Pulse 84fdc5b8): scope-filtered vendor search, Vendor 360 procurement references, supplier PO link, open reviews. */
class VendorCollabService {
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
            throw Object.assign(new Error(Array.isArray(raw) ? raw.join(', ') : (raw || 'API Request failed')), { status: response.status });
        }
        return response.json();
    }

    async searchEligible(scope: EligibilityScope): Promise<EligibleVendor[]> {
        const { item_id, ...rest } = scope;
        const res = await this.request('/vendors/eligibility/search', {
            method: 'POST',
            body: JSON.stringify({
                module: 'procurement',
                ...rest,
                scope: item_id ? { item_id } : undefined,
                decisions: ['eligible', 'conditional', 'ineligible'],
                limit: 100,
            }),
        });
        return Array.isArray(res?.items) ? res.items : [];
    }

    procurementActivity(vendorId: string, type?: string) {
        return this.request(`/vendors/${vendorId}/procurement-activity${type ? `?type=${encodeURIComponent(type)}` : ''}`);
    }

    openCommitmentReviews(sourceType = 'purchase_order') {
        return this.request(`/vendors/commitment-reviews?source_type=${encodeURIComponent(sourceType)}`);
    }

    createPoLink(poId: string, ttlDays?: number) {
        return this.request(`/procurement/po/${poId}/vendor-link`, { method: 'POST', body: JSON.stringify(ttlDays ? { ttl_days: ttlDays } : {}) });
    }
    listPoLinks(poId: string) { return this.request(`/procurement/po/${poId}/vendor-link`); }
    revokePoLink(poId: string, linkId: string) { return this.request(`/procurement/po/${poId}/vendor-link/${linkId}`, { method: 'DELETE' }); }
}

export const vendorCollabService = new VendorCollabService();
