/**
 * Extended unit tests for InventoryService — covering additional methods and edge cases
 * not yet covered in inventoryService.spec.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
  // Locations/tax-codes/settings are now TTL-cached on the singleton; reset so
  // each test starts from a clean miss.
  inventoryService.clearOrgStaticCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const jsonFail = (status: number, message: string) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) } as any);

describe('inventoryService — extended coverage', () => {
  describe('Given getItems with sorting params', () => {
    it('When called with sortBy / Then appends sort_by param', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems({ sortBy: 'name' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('sort_by=name');
    });

    it('When called with sortOrder asc / Then appends sort_order param', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems({ sortOrder: 'asc' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('sort_order=asc');
    });

    it('When called with sortOrder desc / Then appends sort_order=desc', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems({ sortOrder: 'desc' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('sort_order=desc');
    });

    it('When called with no params / Then URL has no query string', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItems();
      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('?');
    });
  });

  describe('Given getItemsLegacy', () => {
    it('When response has data property / Then returns data array', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [{ id: 'i1' }] }));
      const result = await inventoryService.getItemsLegacy();
      expect(result).toEqual([{ id: 'i1' }]);
    });

    it('When response is a direct array / Then returns array as-is', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'i2' }]));
      const result = await inventoryService.getItemsLegacy();
      expect(Array.isArray(result)).toBe(true);
    });

    it('When called / Then passes limit=10000 to getItems', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.getItemsLegacy();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('limit=10000');
    });
  });

  describe('Given getBusinessSettings', () => {
    it('When called / Then fetches business settings for org', async () => {
      mockFetch.mockReturnValue(jsonOk({ base_currency: 'USD' }));
      const result = await inventoryService.getBusinessSettings();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/business-settings/org-1');
      expect(result.base_currency).toBe('USD');
    });

    it('When API fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(403, 'Forbidden'));
      await expect(inventoryService.getBusinessSettings()).rejects.toThrow('Failed to fetch business settings');
    });

    it('When orgId not set / Then throws OrgId not set', async () => {
      inventoryService.setOrgId('' as any);
      await expect(inventoryService.getBusinessSettings()).rejects.toThrow('OrgId not set');
      inventoryService.setOrgId('org-1');
    });
  });

  describe('Given getCatalogItems', () => {
    it('When called / Then fetches from core products endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'cp1', name: 'Catalog Product' }]));
      const result = await inventoryService.getCatalogItems();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/products/org-1');
      expect(result[0].id).toBe('cp1');
    });
  });

  describe('Given warehouse operations (error paths)', () => {
    it('When createWarehouse fails / Then throws error from response', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Duplicate warehouse name'));
      await expect(inventoryService.createWarehouse({ name: 'Existing WH' })).rejects.toThrow('Duplicate warehouse name');
    });

    it('When createWarehouse fails with unparseable error / Then throws fallback message', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse err')) } as any)
      );
      await expect(inventoryService.createWarehouse({ name: 'WH' })).rejects.toThrow('Failed to create warehouse');
    });

    it('When updateWarehouse fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Not found'));
      await expect(inventoryService.updateWarehouse('w1', { name: 'New' })).rejects.toThrow('Failed to update warehouse');
    });

    it('When deleteWarehouse succeeds / Then returns response JSON', async () => {
      mockFetch.mockReturnValue(jsonOk({ deleted: true }));
      const result = await inventoryService.deleteWarehouse('w1');
      expect(result).toEqual({ deleted: true });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
    });

    it('When deleteWarehouse fails with unparseable error / Then throws fallback message', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse err')) } as any)
      );
      await expect(inventoryService.deleteWarehouse('w1')).rejects.toThrow('Failed to delete warehouse');
    });
  });

  describe('Given storage location error paths', () => {
    it('When createLocation fails / Then throws error from response', async () => {
      mockFetch.mockReturnValue(jsonFail(409, 'Location code already exists'));
      await expect(inventoryService.createLocation('w1', { name: 'A', code: 'A1' })).rejects.toThrow('Location code already exists');
    });

    it('When createLocation fails with unparseable error / Then throws fallback message', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse err')) } as any)
      );
      await expect(inventoryService.createLocation('w1', { name: 'A', code: 'A1' })).rejects.toThrow('Failed to create location');
    });

    it('When updateLocation fails / Then throws error from API response', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Location not found'));
      await expect(inventoryService.updateLocation('loc1', { name: 'B' })).rejects.toThrow('Location not found');
    });

    it('When deleteLocation fails / Then throws error from API response', async () => {
      mockFetch.mockReturnValue(jsonFail(403, 'Not authorized'));
      await expect(inventoryService.deleteLocation('loc1')).rejects.toThrow('Not authorized');
    });
  });

  describe('Given createCategory with optional fields', () => {
    it('When called with parentId / Then includes parent_id in body', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'sub1' }));
      await inventoryService.createCategory('Phones', 'Mobile phones', 'cat1');
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.parent_id).toBe('cat1');
      expect(body.description).toBe('Mobile phones');
    });

    it('When called with iconUrl and color / Then includes those in body', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'cat2' }));
      await inventoryService.createCategory('Tech', undefined, undefined, 'https://icon.png', '#ff0000');
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.icon_url).toBe('https://icon.png');
      expect(body.color).toBe('#ff0000');
    });

    it('When called without optional fields / Then only sends name', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'cat3' }));
      await inventoryService.createCategory('Simple');
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.name).toBe('Simple');
      expect(body.parent_id).toBeUndefined();
      expect(body.description).toBeUndefined();
    });
  });

  describe('Given request method headers', () => {
    it('When request made / Then includes Authorization, X-Tenant-Id, X-Org-Id', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await inventoryService.getSettings();
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer tok');
      expect(opts.headers['X-Tenant-Id']).toBe('t-1');
      expect(opts.headers['X-Org-Id']).toBe('org-1');
    });

    it('When response fails with no JSON message / Then throws generic API error', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) } as any)
      );
      await expect(inventoryService.getSettings()).rejects.toThrow('API Request failed');
    });
  });
});
