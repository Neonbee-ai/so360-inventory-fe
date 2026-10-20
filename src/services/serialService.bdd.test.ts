import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.fn();
vi.mock('./inventoryService', () => ({ inventoryService: { request: (...a: any[]) => request(...a), getOrgId: () => 'org-1' } }));
import { serialService } from './serialService';

beforeEach(() => { request.mockReset(); request.mockResolvedValue([]); });

describe('serialService', () => {
    it('Given a partial text / When looked up / Then it hits the org lookup route with q and limit', async () => {
        await serialService.lookup({ q: 'SN', limit: 5 });
        expect(request).toHaveBeenCalledWith('/serials/org-1/lookup?q=SN&limit=5');
    });
    it('Given a customer id / When listed / Then it hits by-customer with the id encoded', async () => {
        await serialService.byCustomer('c/1', 20);
        expect(request).toHaveBeenCalledWith('/serials/org-1/by-customer/c%2F1?limit=20');
    });
    it('Given an item / When picking / Then only in_stock serials of that item are requested', async () => {
        await serialService.availableForItem('item-9');
        expect(request).toHaveBeenCalledWith('/serials/org-1/lookup?item_id=item-9&status=in_stock&limit=50');
    });
    it('Given a wrapped { data } response / When read / Then rows are unwrapped, junk becomes []', async () => {
        request.mockResolvedValueOnce({ data: [{ id: 's' }] });
        expect(await serialService.lookup({ serial: 'X' })).toEqual([{ id: 's' }]);
        request.mockResolvedValueOnce(null);
        expect(await serialService.byCustomer('c')).toEqual([]);
    });
});
