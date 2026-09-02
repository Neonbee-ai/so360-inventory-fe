import { inventoryService } from './inventoryService';

class VendorService {
    private readonly origin: string;
    private readonly baseUrl: string;
    private userId: string | null = null;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        /* v8 ignore next -- import.meta.env is always present under Vite/vitest; the `|| {}` only guards non-Vite bundlers and is unreachable in tests */
        // Bare `import.meta.env` — see procurementService for why the
        // optional-chained form silently ships localhost.
        const env = (import.meta as any).env || {};
        // Hostname-aware smart default: on any *.neonbee.app deployment the
        // correct gateway is always api.neonbee.app/inventory, regardless of
        // whether the shell's window-global injection fired correctly.
        const getDefault = (): string => {
            if (!win?.location) return 'http://localhost:3006';
            const { hostname } = win.location;
            if (hostname === 'neonbee.app' || hostname.endsWith('.neonbee.app')) {
                return 'https://api.neonbee.app/inventory';
            }
            return 'http://localhost:3006';
        };
        const resolved =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            getDefault();
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
            let message: string;
            try {
                const body = await response.json();
                message = body.message || body.error || `Request failed (${response.status})`;
            } catch {
                message = response.status === 405
                    ? 'Vendor API endpoint not reachable — please contact support.'
                    : `Request failed (${response.status} ${response.statusText})`;
            }
            // Carry the HTTP status on the Error so callers can tell an expected
            // authorization denial (403) apart from a genuine server/network
            // failure and message the user accordingly.
            throw Object.assign(new Error(message), { status: response.status });
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
