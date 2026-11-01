import { inventoryService } from './inventoryService';
import type { SerialRecord } from '../utils/serials';

const asList = (res: any): SerialRecord[] => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

/**
 * Serial registry reads (Inventory BE `GET /v1/inventory/serials/:org_id/...`,
 * flag submodule:inventory:serial_tracking). Tenant headers come from inventoryService.
 */
export const serialService = {
    /** Exact serial number, or partial text via `q`; both return customer + order + warranty. */
    async lookup(params: { serial?: string; q?: string; item_id?: string; limit?: number }): Promise<SerialRecord[]> {
        const qs = new URLSearchParams();
        if (params.serial) qs.set('serial', params.serial);
        if (params.q) qs.set('q', params.q);
        if (params.item_id) qs.set('item_id', params.item_id);
        if (params.limit) qs.set('limit', String(params.limit));
        return asList(await inventoryService.request(`/serials/${inventoryService.getOrgId()}/lookup?${qs.toString()}`));
    },

    /** Units a customer bought, newest sale first. */
    async byCustomer(customerId: string, limit?: number): Promise<SerialRecord[]> {
        const qs = limit ? `?limit=${limit}` : '';
        return asList(await inventoryService.request(`/serials/${inventoryService.getOrgId()}/by-customer/${encodeURIComponent(customerId)}${qs}`));
    },

    /** In-stock serials of one item: what a sales order / delivery line can pick from. */
    async availableForItem(itemId: string, limit = 50): Promise<SerialRecord[]> {
        const qs = new URLSearchParams({ item_id: itemId, status: 'in_stock', limit: String(limit) });
        return asList(await inventoryService.request(`/serials/${inventoryService.getOrgId()}/lookup?${qs.toString()}`));
    },
};
