import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
  inventoryService.clearOrgStaticCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

describe('inventoryService org-static cache', () => {
  describe('Given locations are requested concurrently', () => {
    it('When getLocations is called twice at once / Then only one request is made', async () => {
      const d = deferred<any>();
      mockFetch.mockReturnValue(d.promise);

      const all = Promise.all([
        inventoryService.getLocations(),
        inventoryService.getLocations(),
      ]);
      d.resolve({ ok: true, json: () => Promise.resolve([{ id: 'w1' }]) });
      const [a, b] = await all;

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(a).toEqual([{ id: 'w1' }]);
      expect(b).toEqual([{ id: 'w1' }]);
    });

    it('When called again within the TTL / Then the cached value is served', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'w1' }]));
      await inventoryService.getLocations();
      await inventoryService.getLocations();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given tax codes are requested', () => {
    it('When getTaxCodes is called twice within the TTL / Then only one request is made', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'tc1', name: 'GST', rate: 18 }]));

      const first = await inventoryService.getTaxCodes();
      const second = await inventoryService.getTaxCodes();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first[0].rate).toBe(18);
      expect(second[0].rate).toBe(18);
    });
  });

  describe('Given settings are requested', () => {
    it('When getSettings is called twice within the TTL / Then only one request is made', async () => {
      mockFetch.mockReturnValue(jsonOk({ uoms: [], categories: [] }));
      await inventoryService.getSettings();
      await inventoryService.getSettings();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given a settings write', () => {
    it('When createUom runs / Then the next getSettings re-fetches', async () => {
      mockFetch.mockReturnValue(jsonOk({ uoms: [], categories: [] }));
      await inventoryService.getSettings();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockReturnValue(jsonOk({ id: 'uom-new' }));
      await inventoryService.createUom('Box', 'BX');

      mockFetch.mockReturnValue(jsonOk({ uoms: [{ id: 'uom-new' }], categories: [] }));
      await inventoryService.getSettings();
      // 1 initial settings GET + 1 createUom POST + 1 re-fetch = 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Given the org changes', () => {
    it('When setOrgId switches org / Then the cache is dropped and the new org re-fetches', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'w1' }]));
      await inventoryService.getLocations();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      inventoryService.setOrgId('org-2');
      await inventoryService.getLocations();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
