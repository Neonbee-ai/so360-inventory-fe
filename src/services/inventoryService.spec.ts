import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const jsonFail = (status: number, message: string) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) } as any);

describe('inventoryService', () => {
  describe('Given context setters', () => {
    it('When setOrgId called / Then getOrgId returns value', () => {
      inventoryService.setOrgId('org-99');
      expect(inventoryService.getOrgId()).toBe('org-99');
      inventoryService.setOrgId('org-1');
    });
  });

  describe('Given request method', () => {
    it('When orgId not set / Then throws error', async () => {
      inventoryService.setOrgId('' as any);
      await expect(inventoryService.request('/test')).rejects.toThrow('OrgId not set');
      inventoryService.setOrgId('org-1');
    });

    it('When response not ok / Then throws with message', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Bad input'));
      await expect(inventoryService.request('/test')).rejects.toThrow('Bad input');
    });

    it('When response ok / Then returns parsed JSON', async () => {
      mockFetch.mockReturnValue(jsonOk({ items: [] }));
      const result = await inventoryService.request('/test');
      expect(result).toEqual({ items: [] });
    });
  });

  describe('Given getItems', () => {
    it('When called without params / Then makes GET to items endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/items/org-1');
    });

    it('When called with search / Then appends query param', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems({ search: 'widget' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('search=widget');
    });

    it('When called with categoryId / Then appends category_id param', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems({ categoryId: 'cat-1' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('category_id=cat-1');
    });

    it('When called with pagination / Then appends page and limit', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems({ page: 2, limit: 25 });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('page=2');
      expect(url).toContain('limit=25');
    });
  });

  describe('Given getItem', () => {
    it('When called / Then fetches item detail', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'i1', name: 'Widget' }));
      const result = await inventoryService.getItem('i1');
      expect(result.name).toBe('Widget');
    });
  });

  describe('Given createItem', () => {
    it('When called / Then sends POST with org_id', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'i2' }));
      await inventoryService.createItem({ name: 'New Item' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).org_id).toBe('org-1');
    });
  });

  describe('Given updateItem', () => {
    it('When called / Then sends PATCH', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'i1' }));
      await inventoryService.updateItem('i1', { name: 'Updated' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('PATCH');
    });
  });

  describe('Given deleteItem', () => {
    it('When called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await inventoryService.deleteItem('i1');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('Given getLocations', () => {
    it('When called / Then fetches warehouses for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'w1' }]));
      const result = await inventoryService.getLocations();
      expect(result[0].id).toBe('w1');
    });
  });

  describe('Given warehouse CRUD', () => {
    it('When getWarehouse called / Then fetches warehouse detail', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'w1', name: 'Main' }));
      const result = await inventoryService.getWarehouse('w1');
      expect(result.name).toBe('Main');
    });

    it('When createWarehouse called / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'w2' }));
      await inventoryService.createWarehouse({ name: 'New WH' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
    });

    it('When updateWarehouse called / Then sends PATCH', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'w1' }));
      await inventoryService.updateWarehouse('w1', { name: 'Renamed' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('PATCH');
    });

    it('When deleteWarehouse fails / Then throws', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Cannot delete'));
      await expect(inventoryService.deleteWarehouse('w1')).rejects.toThrow('Cannot delete');
    });
  });

  describe('Given storage locations', () => {
    it('When createLocation called / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'loc1' }));
      await inventoryService.createLocation('w1', { name: 'Shelf A', code: 'SA' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/locations');
      expect(opts.method).toBe('POST');
    });

    it('When updateLocation called / Then sends PATCH', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'loc1' }));
      await inventoryService.updateLocation('loc1', { name: 'Shelf B' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('PATCH');
    });

    it('When deleteLocation called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await inventoryService.deleteLocation('loc1');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('Given stock operations', () => {
    it('When getStockOverview called / Then fetches stock', async () => {
      mockFetch.mockReturnValue(jsonOk({ items: [] }));
      await inventoryService.getStockOverview();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/stock-overview/org-1');
    });

    it('When createAdjustment called / Then sends POST with org_id', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'adj1' }));
      await inventoryService.createAdjustment({ item_id: 'i1', quantity: 10 });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).org_id).toBe('org-1');
    });

    it('When createTransfer called / Then sends POST with org_id', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'tr1' }));
      await inventoryService.createTransfer({ item_id: 'i1', from: 'w1', to: 'w2', quantity: 5 });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
    });

    it('When getLedger called / Then fetches movements for item', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      await inventoryService.getLedger('i1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/movements/org-1/i1');
    });
  });

  describe('Given tax codes', () => {
    it('When getTaxCodes returns array / Then maps to correct shape', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'tc1', name: 'GST 18%', code: 'GST18', rate: 18 }]));
      const result = await inventoryService.getTaxCodes();
      expect(result[0]).toEqual({ id: 'tc1', name: 'GST 18%', code: 'GST18', rate: 18, jurisdiction: undefined });
    });

    it('When getTaxCodes returns paginated / Then unwraps data', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [{ id: 'tc1', name: 'VAT', rate: 20 }] }));
      const result = await inventoryService.getTaxCodes();
      expect(result[0].name).toBe('VAT');
    });

    it('When getTaxCodes fails / Then returns empty array', async () => {
      mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) } as any));
      const result = await inventoryService.getTaxCodes();
      expect(result).toEqual([]);
    });
  });

  describe('Given settings', () => {
    it('When getSettings called / Then fetches settings for org', async () => {
      mockFetch.mockReturnValue(jsonOk({ uoms: [] }));
      await inventoryService.getSettings();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/settings/org-1');
    });

    it('When createUom called / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'uom1' }));
      await inventoryService.createUom('Kilogram', 'KG');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ name: 'Kilogram', abbreviation: 'KG' });
    });

    it('When deleteUom called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await inventoryService.deleteUom('uom1');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('Given categories', () => {
    it('When createCategory called / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'cat1' }));
      await inventoryService.createCategory('Electronics', 'Electronic items');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
    });

    it('When updateCategory called / Then sends PATCH', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'cat1' }));
      await inventoryService.updateCategory('cat1', { name: 'Updated' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('PATCH');
    });

    it('When deleteCategory called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await inventoryService.deleteCategory('cat1');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('Given movement history', () => {
    it('When getAdjustmentHistory with itemId / Then appends query', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      await inventoryService.getAdjustmentHistory('i1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('item_id=i1');
    });

    it('When getTransferHistory without itemId / Then no query', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      await inventoryService.getTransferHistory();
      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('item_id');
    });
  });

  describe('Given product lifecycle', () => {
    it('When transitionLifecycle called / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ ok: true }));
      await inventoryService.transitionLifecycle('i1', 'activate', 'Ready');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/lifecycle/transition');
      expect(opts.method).toBe('POST');
    });

    it('When getLifecycleGates called / Then fetches gates', async () => {
      mockFetch.mockReturnValue(jsonOk({ gates: [] }));
      await inventoryService.getLifecycleGates('i1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/lifecycle/gates');
    });
  });

  describe('Given GL inventory valuation', () => {
    it('When successful / Then returns balance', async () => {
      mockFetch.mockReturnValue(jsonOk({ gl_balance: 50000, source: 'accounting' }));
      const result = await inventoryService.getGLInventoryValuation();
      expect(result.gl_balance).toBe(50000);
    });

    it('When fails / Then returns fallback', async () => {
      mockFetch.mockReturnValue(jsonFail(500, 'fail'));
      const result = await inventoryService.getGLInventoryValuation();
      expect(result.gl_balance).toBe(0);
      expect(result.source).toBe('unavailable');
    });
  });
});
