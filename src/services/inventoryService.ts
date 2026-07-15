import { createRequestCache } from './requestCache';

class InventoryService {
    private orgId: string | null = null;
    private tenantId: string | null = null;
    private accessToken: string | null = null;
    private inventoryOrigin: string;
    private coreOrigin: string;
    private baseUrl: string;
    // Locations, tax codes and settings are org-static and read on most item/stock
    // pages. Coalesce concurrent reads and serve a short TTL keyed by org; a fresh
    // org via setOrgId clears it so we never serve another org's data.
    private orgStaticCache = createRequestCache({ defaultTtlMs: 30_000, maxEntries: 50 });

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any)?.env || {};

        const isNeonbeeHost =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'neonbee.app' ||
                window.location.hostname.endsWith('.neonbee.app'));

        const invOrigin =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            (isNeonbeeHost ? 'https://api.neonbee.app/inventory' : 'http://localhost:3006');

        const coreOrigin =
            (win && win.VITE_SO360_CORE_API) ||
            env.VITE_SO360_CORE_API ||
            (isNeonbeeHost ? 'https://api.neonbee.app/core' : 'http://localhost:3000');

        this.inventoryOrigin = String(invOrigin).replace(/\/$/, '');
        this.coreOrigin = String(coreOrigin).replace(/\/$/, '');
        this.baseUrl = `${this.inventoryOrigin}/v1/inventory`;
    }

    setOrgId(id: string) {
        if (this.orgId !== id) this.orgStaticCache.invalidate();
        this.orgId = id;
    }

    setTenantId(id: string) {
        this.tenantId = id;
    }

    setAccessToken(token: string) {
        this.accessToken = token;
    }

    getOrgId() {
        return this.orgId;
    }

    /** Drop the org-static (locations/tax-codes/settings) cache. */
    clearOrgStaticCache() {
        this.orgStaticCache.invalidate();
    }

    public async request(endpoint: string, options: RequestInit = {}) {
        if (!this.orgId) throw new Error('OrgId not set');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Tenant-Id': this.tenantId || '',
            'X-Org-Id': this.orgId || '',
            ...options.headers,
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'API Request failed' }));
            throw new Error(error.message || 'API Request failed');
        }

        // A successful settings write (UoMs, categories, …) makes the cached
        // settings stale — drop it so the next getSettings reads fresh.
        const method = (options.method || 'GET').toUpperCase();
        if (method !== 'GET' && endpoint.startsWith('/settings/')) {
            this.orgStaticCache.invalidate(`settings|${this.orgId}`);
        }
        // A successful item write (create/update/delete) makes the cached
        // reference catalog stale — drop it so the next getItems() reads fresh.
        if (method !== 'GET' && endpoint.startsWith('/items')) {
            this.orgStaticCache.invalidate(`items|${this.orgId}`);
        }

        return response.json();
    }

    // Items
    async getItems(params?: {
        search?: string;
        categoryId?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        page?: number;
        limit?: number;
    }) {
        const query = new URLSearchParams();
        if (params?.search) query.append('search', params.search);
        if (params?.categoryId) query.append('category_id', params.categoryId);
        if (params?.sortBy) query.append('sort_by', params.sortBy);
        if (params?.sortOrder) query.append('sort_order', params.sortOrder);
        if (params?.page) query.append('page', params.page.toString());
        if (params?.limit) query.append('limit', params.limit.toString());
        const queryStr = query.toString();
        // The param-less call is the org reference catalog read that the
        // Adjustments/Transfers tabs re-run on every toggle. Serve it from the
        // short-TTL cache so toggling does not re-fetch the whole catalog; any
        // search/sort/paginated call (queryStr present) bypasses the cache and
        // hits the network exactly as before.
        if (!queryStr) {
            return this.orgStaticCache.run(`items|${this.orgId}`, () =>
                this.request(`/items/${this.orgId}`),
            );
        }
        return this.request(`/items/${this.orgId}?${queryStr}`);
    }

    async getItemsLegacy() {
        // Legacy method for backward compatibility - returns all items
        const result = await this.getItems({ limit: 10000 });
        return result.data || result; // Handle both old and new response format
    }

    async getItem(id: string) {
        return this.request(`/items/detail/${id}`);
    }

    async createItem(dto: any) {
        return this.request('/items', {
            method: 'POST',
            body: JSON.stringify({ ...dto, org_id: this.orgId }),
        });
    }

    async updateItem(id: string, dto: any) {
        return this.request(`/items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deleteItem(id: string) {
        return this.request(`/items/${id}`, {
            method: 'DELETE',
        });
    }

    // Warehouses/Locations
    async getLocations() {
        return this.orgStaticCache.run(`locations|${this.orgId}`, () =>
            this.request(`/warehouses/${this.orgId}`),
        );
    }

    async getWarehouse(id: string) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses/detail/${id}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            }
        });
        if (!response.ok) throw new Error('Failed to load warehouse');
        return response.json();
    }

    async createWarehouse(dto: any) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
            body: JSON.stringify(dto),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to create warehouse' }));
            throw new Error(error.message);
        }
        return response.json();
    }

    async updateWarehouse(id: string, dto: any) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
            body: JSON.stringify(dto),
        });
        if (!response.ok) throw new Error('Failed to update warehouse');
        return response.json();
    }

    async deleteWarehouse(id: string) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to delete warehouse' }));
            throw new Error(error.message);
        }
        return response.json();
    }

    // Storage Locations
    async createLocation(warehouseId: string, dto: { name: string; code: string }) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses/${warehouseId}/locations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
            body: JSON.stringify(dto),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to create location' }));
            throw new Error(error.message);
        }
        return response.json();
    }

    async updateLocation(locationId: string, dto: { name?: string; code?: string; is_active?: boolean }) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses/locations/${locationId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
            body: JSON.stringify(dto),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to update location' }));
            throw new Error(error.message);
        }
        return response.json();
    }

    async deleteLocation(locationId: string) {
        const response = await fetch(`${this.inventoryOrigin}/v1/warehouses/locations/${locationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to delete location' }));
            throw new Error(error.message);
        }
        return response.json();
    }

    // Stock Overview
    async getStockOverview() {
        return this.request(`/stock-overview/${this.orgId}`);
    }

    // GL Inventory Valuation (from Accounting)
    async getGLInventoryValuation(): Promise<{ gl_balance: number; source: string }> {
        try {
            return await this.request(`/stock-overview/${this.orgId}/gl-valuation`);
        } catch {
            return { gl_balance: 0, source: 'unavailable' };
        }
    }

    // Adjustments
    async createAdjustment(dto: any) {
        return this.request('/adjust', {
            method: 'POST',
            body: JSON.stringify({ ...dto, org_id: this.orgId }),
        });
    }

    // Transfers
    async createTransfer(dto: any) {
        return this.request('/transfer', {
            method: 'POST',
            body: JSON.stringify({ ...dto, org_id: this.orgId }),
        });
    }

    // Ledger
    async getLedger(itemId: string) {
        return this.request(`/movements/${this.orgId}/${itemId}`);
    }

    async getItemSalesHistory(itemId: string): Promise<{
        item_id: string;
        total_quantity_sold: number;
        invoice_count: number;
        recent_movements: any[];
    }> {
        return this.request(`/items/${this.orgId}/${itemId}/sales-history`);
    }

    // Simple getItems for Master Catalog (if separate)
    async getCatalogItems() {
        const response = await fetch(`${this.coreOrigin}/v1/products/${this.orgId}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            }
        });
        return response.json();
    }

    // ==================== Tax Codes (Core Backend) ====================

    /**
     * Fetch all active tax codes from Core Backend for the current org.
     * Endpoint: GET /v1/financials/tax-codes/:orgId
     */
    async getTaxCodes(): Promise<{ id: string; name: string; code?: string; rate: number; jurisdiction?: string }[]> {
        if (!this.orgId) throw new Error('OrgId not set');
        return this.orgStaticCache.run(`tax-codes|${this.orgId}`, () => this.fetchTaxCodes());
    }

    private async fetchTaxCodes(): Promise<{ id: string; name: string; code?: string; rate: number; jurisdiction?: string }[]> {
        const endpoint = `${this.coreOrigin}/v1/financials/tax-codes/${this.orgId}`;
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
        });
        if (!response.ok) {
            console.error(`[InventoryService] Could not fetch tax codes from Core API (${response.status}) at ${endpoint}`);
            return [];
        }
        const result = await response.json().catch(() => null);
        let rows: any[] = [];

        // Core API may return array or paginated object: { data: [...] }
        if (Array.isArray(result)) {
            rows = result;
        } else if (result && Array.isArray((result as any).data)) {
            rows = (result as any).data;
        } else {
            console.error('[InventoryService] Unexpected tax codes payload shape from Core API', result);
            return [];
        }

        return rows
            .filter((row: any) => row && typeof row.id === 'string')
            .map((row: any) => ({
                id: row.id,
                name: row.name || row.code || 'Tax Code',
                code: row.code || undefined,
                rate: Number(row.rate ?? 0),
                jurisdiction: row.jurisdiction || undefined,
            }));
    }

    // ==================== Business Settings (Core Backend) ====================

    async getBusinessSettings() {
        if (!this.orgId) throw new Error('OrgId not set');
        const response = await fetch(`${this.coreOrigin}/v1/business-settings/${this.orgId}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': this.orgId || '',
            },
        });
        if (!response.ok) throw new Error('Failed to fetch business settings');
        return response.json();
    }

    // ==================== Settings ====================

    async getSettings() {
        return this.orgStaticCache.run(`settings|${this.orgId}`, () =>
            this.request(`/settings/${this.orgId}`),
        );
    }

    async createUom(name: string, abbreviation: string) {
        return this.request(`/settings/${this.orgId}/uoms`, {
            method: 'POST',
            body: JSON.stringify({ name, abbreviation }),
        });
    }

    async deleteUom(id: string) {
        return this.request(`/settings/${this.orgId}/uoms/${id}`, {
            method: 'DELETE',
        });
    }

    async createCategory(name: string, description?: string, parentId?: string, iconUrl?: string, color?: string) {
        const body: Record<string, any> = { name };
        if (description) body.description = description;
        if (parentId) body.parent_id = parentId;
        if (iconUrl) body.icon_url = iconUrl;
        if (color) body.color = color;
        return this.request(`/settings/${this.orgId}/categories`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async updateCategory(id: string, data: { name?: string; description?: string; parent_id?: string | null; icon_url?: string | null; image_url?: string | null; color?: string | null; sort_order?: number }) {
        return this.request(`/settings/${this.orgId}/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteCategory(id: string) {
        return this.request(`/settings/${this.orgId}/categories/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== Attribute Definitions ====================

    async getAttributeDefinitions(categoryId?: string) {
        const query = categoryId ? `?category_id=${categoryId}` : '';
        return this.request(`/settings/${this.orgId}/attribute-definitions${query}`);
    }

    async createAttributeDefinition(dto: {
        category_id?: string;
        attribute_key: string;
        attribute_label: string;
        attribute_type: 'text' | 'number' | 'currency' | 'select' | 'multi_select' | 'date' | 'boolean' | 'radio' | 'textarea' | 'file';
        options?: { value: string; label: string }[];
        unit?: string;
        description?: string;
        is_required?: boolean;
        sort_order?: number;
    }) {
        return this.request(`/settings/${this.orgId}/attribute-definitions`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateAttributeDefinition(id: string, dto: Partial<{
        category_id?: string;
        attribute_label: string;
        attribute_type: 'text' | 'number' | 'currency' | 'select' | 'multi_select' | 'date' | 'boolean' | 'radio' | 'textarea' | 'file';
        options?: { value: string; label: string }[];
        unit?: string;
        description?: string;
        is_required?: boolean;
        sort_order?: number;
    }>) {
        return this.request(`/settings/${this.orgId}/attribute-definitions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deleteAttributeDefinition(id: string) {
        return this.request(`/settings/${this.orgId}/attribute-definitions/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== Default Logic Settings ====================

    async getOrgDefaultLogic(): Promise<{ allow_negative_stock: boolean; auto_approve_transfers: boolean }> {
        return this.request(`/settings/${this.orgId}/org-defaults`);
    }

    async updateOrgDefaultLogic(dto: { allow_negative_stock?: boolean; auto_approve_transfers?: boolean }) {
        return this.request(`/settings/${this.orgId}/org-defaults`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    // ==================== Movement History ====================

    async getAdjustmentHistory(itemId?: string) {
        const query = itemId ? `?item_id=${itemId}` : '';
        return this.request(`/adjustments/${this.orgId}${query}`);
    }

    async getTransferHistory(itemId?: string) {
        const query = itemId ? `?item_id=${itemId}` : '';
        return this.request(`/transfers/${this.orgId}${query}`);
    }

    // ==================== Product Lifecycle ====================

    async getOnlineProducts() {
        return this.request(`/items/${this.orgId}/online`);
    }

    async transitionLifecycle(itemId: string, transitionCode: string, comment?: string) {
        return this.request(`/items/${itemId}/lifecycle/transition`, {
            method: 'POST',
            body: JSON.stringify({ transition_code: transitionCode, comment }),
        });
    }

    async getLifecycleGates(itemId: string) {
        return this.request(`/items/${itemId}/lifecycle/gates`);
    }

    // ==================== Bulk Import ====================

    async bulkImportParseCsv(orgId: string, file: File): Promise<any> {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(`${this.inventoryOrigin}/v1/bulk-import/${orgId}/parse-csv`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': orgId,
            },
            body: form,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Failed to parse CSV' }));
            throw new Error(err.message || 'Failed to parse CSV');
        }
        return response.json();
    }

    async bulkImportUploadImages(orgId: string, files: File[]): Promise<any> {
        const form = new FormData();
        files.forEach(f => form.append('images', f));
        const response = await fetch(`${this.inventoryOrigin}/v1/bulk-import/${orgId}/upload-images`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': orgId,
            },
            body: form,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Failed to upload images' }));
            throw new Error(err.message || 'Failed to upload images');
        }
        return response.json();
    }

    async bulkImportCommit(orgId: string, rows: any[]): Promise<any> {
        const response = await fetch(`${this.inventoryOrigin}/v1/bulk-import/${orgId}/commit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'X-Tenant-Id': this.tenantId || '',
                'X-Org-Id': orgId,
            },
            body: JSON.stringify({ rows }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Import failed' }));
            throw new Error(err.message || 'Import failed');
        }
        return response.json();
    }
}

export const inventoryService = new InventoryService();
