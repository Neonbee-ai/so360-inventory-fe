import { inventoryService } from './inventoryService';

export type ProcurementReport =
    | 'purchase_register'
    | 'open_purchase_orders'
    | 'delayed_deliveries'
    | 'pending_approvals'
    | 'pending_grns'
    | 'rejected_materials'
    | 'procurement_aging'
    | 'vendor_spend'
    | 'project_procurement'
    | 'manufacturing_procurement'
    | 'savings'
    | 'lead_time_analysis'
    | 'budget_vs_actual'
    | 'purchase_cost_analysis';

/** Dashboard, vendor scorecard, trends and the report pack. */
class ProcurementInsightsService {
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
        this.baseUrl = `${String(resolved).replace(/\/$/, '')}/v1/procurement/insights`;
    }

    private async request(endpoint: string) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(inventoryService as any).accessToken}`,
                'X-Tenant-Id': (inventoryService as any).tenantId || '',
                'X-Org-Id': inventoryService.getOrgId() || '',
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

    async getDashboard() {
        return this.request(`/dashboard/${inventoryService.getOrgId()}`);
    }

    async getVendorPerformance(vendorId?: string) {
        const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
        return this.request(`/vendor-performance/${inventoryService.getOrgId()}${qs}`);
    }

    async getTrends(months?: number) {
        const qs = months ? `?months=${months}` : '';
        return this.request(`/trends/${inventoryService.getOrgId()}${qs}`);
    }

    async getReport(report: ProcurementReport, filters: { from?: string; to?: string; vendor_id?: string; project_id?: string } = {}) {
        const qs = new URLSearchParams({ report });
        if (filters.from) qs.append('from', filters.from);
        if (filters.to) qs.append('to', filters.to);
        if (filters.vendor_id) qs.append('vendor_id', filters.vendor_id);
        if (filters.project_id) qs.append('project_id', filters.project_id);
        return this.request(`/reports/${inventoryService.getOrgId()}?${qs.toString()}`);
    }
}

export const procurementInsightsService = new ProcurementInsightsService();
