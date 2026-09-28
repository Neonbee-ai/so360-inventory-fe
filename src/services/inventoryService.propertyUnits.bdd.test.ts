import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as any);
const jsonFail = (status: number, body: any) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) } as any);

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
  inventoryService.clearOrgStaticCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const dto = {
  floor_from: 1,
  floor_to: 2,
  units_per_floor: 2,
  numbering_pattern: '{floor}{stack:02}',
  sku_prefix: 'T1',
  stacks: [{ stack: '01', bedrooms: 2, area_sqft: 1100, view: 'Sea', price: 150000 }],
};

describe('inventoryService property units', () => {
  describe('Given a tower id and a generate payload', () => {
    describe('When generateUnits is called', () => {
      it('Then it POSTs the backend contract to the tower units/generate route and returns the counts', async () => {
        mockFetch.mockReturnValue(jsonOk({ created: 3, skipped: 1 }));
        const res = await inventoryService.generateUnits('tower-1', dto);
        expect(res).toEqual({ created: 3, skipped: 1 });
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/v1\/inventory\/property\/org-1\/towers\/tower-1\/units\/generate$/);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({
          floor_from: 1,
          floor_to: 2,
          units_per_floor: 2,
          pattern: '{floor}{stack:02}',
          sku_prefix: 'T1',
          stacks: [{ stack: 1, bedrooms: 2, area_sqft: 1100, view: 'Sea', price: 150000 }],
        });
        expect(init.headers['X-Org-Id']).toBe('org-1');
      });

      it('Then empty optional fields are left out rather than sent as null', async () => {
        mockFetch.mockReturnValue(jsonOk({ created: 1, skipped: 0 }));
        await inventoryService.generateUnits('tower-1', {
          ...dto,
          sku_prefix: '',
          stacks: [{ stack: '2', bedrooms: null, area_sqft: undefined, view: '', price: null }],
        });
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.sku_prefix).toBeUndefined();
        expect(body.stacks).toEqual([{ stack: 2 }]);
      });

      it('Then a missing count in the response reads as 0', async () => {
        mockFetch.mockReturnValue(jsonOk({}));
        await expect(inventoryService.generateUnits('tower-1', dto)).resolves.toEqual({ created: 0, skipped: 0 });
      });

      it('Then the cached item catalog is dropped so the next getItems refetches', async () => {
        mockFetch.mockReturnValue(jsonOk([]));
        await inventoryService.getItems();
        mockFetch.mockReturnValue(jsonOk({ created: 1, skipped: 0 }));
        await inventoryService.generateUnits('tower-1', dto);
        mockFetch.mockReturnValue(jsonOk([]));
        await inventoryService.getItems();
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    });

    describe('When the backend rejects it', () => {
      it('Then the backend message is thrown', async () => {
        mockFetch.mockReturnValue(jsonFail(400, { message: 'floor_to must be >= floor_from' }));
        await expect(inventoryService.generateUnits('tower-1', dto)).rejects.toThrow('floor_to must be >= floor_from');
      });
    });
  });

  describe('Given a project id', () => {
    describe('When getCategoryAvailability is called', () => {
      it('Then it GETs the project availability route and flattens tower counts', async () => {
        mockFetch.mockReturnValue(jsonOk({
          project: { id: 'proj-1', name: 'Marina' },
          totals: { total: 2, available: 1, on_hold: 0, sold: 1 },
          towers: [{ category_id: 't1', name: 'Tower A', counts: { total: 2, available: 1, on_hold: 0, sold: 1 } }],
          units: [{ item_id: 'i1', unit_number: '101', floor: 1, stack: 1, status: 'sold' }],
        }));
        const res = await inventoryService.getCategoryAvailability('proj-1');
        expect(res).toEqual({
          towers: [{ category_id: 't1', name: 'Tower A', total: 2, available: 1, on_hold: 0, sold: 1 }],
          units: [{ item_id: 'i1', unit_number: '101', floor: 1, stack: '1', status: 'sold' }],
        });
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/property\/org-1\/projects\/proj-1\/availability$/);
        expect(init.method).toBeUndefined();
      });

      it('Then a malformed response is normalised to empty lists', async () => {
        mockFetch.mockReturnValue(jsonOk({ towers: null }));
        await expect(inventoryService.getCategoryAvailability('proj-1')).resolves.toEqual({ towers: [], units: [] });
      });
    });
  });

  describe('Given developer partners exist in Core', () => {
    describe('When searchDevelopers is called with a search term', () => {
      it('Then it asks Core partners for type=developer and maps id/name', async () => {
        mockFetch.mockReturnValue(jsonOk({ data: [{ id: 'p1', name: 'Emaar' }, { id: 'p2', display_name: 'Nakheel' }, { name: 'no id' }] }));
        const res = await inventoryService.searchDevelopers('ema');
        expect(res).toEqual([{ id: 'p1', name: 'Emaar' }, { id: 'p2', name: 'Nakheel' }]);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toContain('/v1/partners/org-1?');
        expect(url).toContain('type=developer');
        expect(url).toContain('limit=100');
        expect(url).toContain('search=ema');
        expect(init.headers.Authorization).toBe('Bearer tok');
      });
    });

    describe('When Core returns a bare array', () => {
      it('Then it still maps the partners', async () => {
        mockFetch.mockReturnValue(jsonOk([{ id: 'p9', name: 'Sobha' }]));
        await expect(inventoryService.searchDevelopers()).resolves.toEqual([{ id: 'p9', name: 'Sobha' }]);
        expect(mockFetch.mock.calls[0][0]).not.toContain('search=');
      });
    });

    describe('When Core fails', () => {
      it('Then the error propagates', async () => {
        mockFetch.mockReturnValue(jsonFail(500, {}));
        await expect(inventoryService.searchDevelopers()).rejects.toThrow('Request failed (500)');
      });
    });
  });

  describe('Given a category update with project metadata', () => {
    describe('When updateCategory is called', () => {
      it('Then metadata is sent in the PATCH body', async () => {
        mockFetch.mockReturnValue(jsonOk({ id: 'c1' }));
        await inventoryService.updateCategory('c1', { metadata: { location: 'Dubai Marina', brochure_url: null } });
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/settings\/org-1\/categories\/c1$/);
        expect(init.method).toBe('PATCH');
        expect(JSON.parse(init.body)).toEqual({ metadata: { location: 'Dubai Marina', brochure_url: null } });
      });
    });
  });
});
