import { inventoryService } from './inventoryService';

class VendorService {
    private readonly origin: string;
    private readonly baseUrl: string;
    private userId: string | null = null;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any)?.env || {};
        const resolved =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            env.VITE_API_BASE_URL ||
            'http://localhost:3006';
        this.origin = String(resolved).replace(/\/$/, '');
        this.baseUrl = `${this.origin}/v1/vendors`;
    }

    setUserId(id: string) {
        this.userId = id;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const orgId = inventoryService.getOrgId();
        const tenantId = (inventoryService as any).tenantId;
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(inventoryService as any).accessToken}`,
                'X-Tenant-Id': tenantId || '',
                'X-Org-Id': orgId || '',
                'x-user-id': this.userId || '',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'API Request failed' }));
            throw new Error(error.message || 'API Request failed');
        }

        return response.json();
    }

    async getVendors() {
        return this.request(`/${inventoryService.getOrgId()}`);
    }

    async createVendor(dto: any) {
        return this.request('', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getVendorDetail(id: string) {
        return this.request(`/detail/${id}`);
    }

    async updateVendor(id: string, dto: any) {
        return this.request(`/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deleteVendor(id: string) {
        return this.request(`/${id}`, {
            method: 'DELETE',
        });
    }

    async getContracts() {
        return this.request(`/contracts/${inventoryService.getOrgId()}`);
    }

    async createContract(dto: any) {
        return this.request('/contracts', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async rateVendor(vendorId: string, rating: number) {
        return this.request(`/${vendorId}/rate`, {
            method: 'POST',
            body: JSON.stringify({ rating }),
        });
    }

    async getVendorRating(vendorId: string) {
        return this.request(`/${vendorId}/rating`);
    }
}

export const vendorService = new VendorService();
