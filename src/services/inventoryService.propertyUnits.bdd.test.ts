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
          towers: [{ category_id: 't1', name: 'Tower A', total: 2, available: 1, on_hold: 0, sold: 1, blocked: 0, cancelled: 0, unavailable: 0 }],
          units: [{ item_id: 'i1', unit_number: '101', floor: 1, stack: '1', status: 'sold' }],
          totals: { total: 2, available: 1, on_hold: 0, sold: 1, blocked: 0, cancelled: 0, unavailable: 0 },
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
        expect(res).toEqual([{ id: 'p1', name: 'Emaar', role: 'developer' }, { id: 'p2', name: 'Nakheel', role: 'developer' }]);
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
        await expect(inventoryService.searchDevelopers()).resolves.toEqual([{ id: 'p9', name: 'Sobha', role: 'developer' }]);
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

describe('inventoryService property units edge branches', () => {
  describe('Given generateUnits with no units_per_floor and a blank pattern', () => {
    it('Then both keys are left out of the body', async () => {
      mockFetch.mockReturnValue(jsonOk({ created: 1, skipped: 0 }));
      await inventoryService.generateUnits('tower-1', { ...dto, units_per_floor: 0, numbering_pattern: '' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).not.toHaveProperty('units_per_floor');
      expect(body).not.toHaveProperty('pattern');
      expect(body).toMatchObject({ floor_from: 1, floor_to: 2, sku_prefix: 'T1' });
    });
  });

  describe('Given generateUnits gets a null JSON body', () => {
    it('Then both counts read as 0', async () => {
      mockFetch.mockReturnValue(jsonOk(null));
      await expect(inventoryService.generateUnits('tower-1', dto)).resolves.toEqual({ created: 0, skipped: 0 });
    });
  });

  describe('Given getCategoryAvailability returns flat and null towers', () => {
    it('Then flat counts are read from the tower and a null tower reads as zeros', async () => {
      mockFetch.mockReturnValue(jsonOk({
        towers: [
          { category_id: 't1', name: 'Flat', total: '4', available: 3, on_hold: null, sold: 'x' },
          null,
        ],
        units: [
          { item_id: 'a', floor: 1, stack: null },
          { item_id: 'b', floor: 1 },
          { item_id: 'c', floor: 1, stack: 0 },
        ],
      }));
      const res = await inventoryService.getCategoryAvailability('proj-1');
      expect(res.towers).toEqual([
        { category_id: 't1', name: 'Flat', total: 4, available: 3, on_hold: 0, sold: 0, blocked: 0, cancelled: 0, unavailable: 0 },
        { category_id: undefined, name: undefined, total: 0, available: 0, on_hold: 0, sold: 0, blocked: 0, cancelled: 0, unavailable: 0 },
      ]);
      expect(res.units.map((u) => u.stack)).toEqual(['', '', '0']);
    });
  });

  describe('Given getCategoryAvailability gets a null JSON body', () => {
    it('Then both lists are empty', async () => {
      mockFetch.mockReturnValue(jsonOk(null));
      await expect(inventoryService.getCategoryAvailability('proj-1')).resolves.toEqual({ towers: [], units: [] });
    });
  });

  describe('Given no org is set', () => {
    it('Then searchDevelopers throws without calling Core', async () => {
      inventoryService.setOrgId('');
      await expect(inventoryService.searchDevelopers()).rejects.toThrow('OrgId not set');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Given Core returns an object with no data array', () => {
    it('Then an empty object yields no developers', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await expect(inventoryService.searchDevelopers()).resolves.toEqual([]);
    });

    it('Then a non-array data field yields no developers', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: { not: 'array' } }));
      await expect(inventoryService.searchDevelopers()).resolves.toEqual([]);
    });

    it('Then a null body yields no developers', async () => {
      mockFetch.mockReturnValue(jsonOk(null));
      await expect(inventoryService.searchDevelopers()).resolves.toEqual([]);
    });
  });

  describe('Given partner entries that are null or have no name', () => {
    it('Then nulls are dropped and the id is used as the name', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [null, { id: 42 }] }));
      await expect(inventoryService.searchDevelopers()).resolves.toEqual([{ id: '42', name: '42', role: 'developer' }]);
    });
  });
});

describe('inventoryService RE unit status and developer (G1/G3)', () => {
  describe('Given availability with manual-status buckets and totals', () => {
    describe('When getCategoryAvailability is called', () => {
      it('Then blocked/cancelled/unavailable counts and totals are carried through', async () => {
        const counts = { total: 6, available: 1, on_hold: 1, sold: 1, blocked: 1, cancelled: 1, unavailable: 1 };
        mockFetch.mockReturnValue(jsonOk({
          totals: counts,
          towers: [{ category_id: 't1', name: 'A', counts }],
          units: [{ item_id: 'u1', stack: '01', status: 'blocked', status_override: 'blocked', currency: 'AED' }],
        }));
        const res = await inventoryService.getCategoryAvailability('proj-1');
        expect(res.totals).toEqual(counts);
        expect(res.towers[0]).toEqual({ category_id: 't1', name: 'A', ...counts });
        expect(res.units[0]).toMatchObject({ status: 'blocked', status_override: 'blocked', currency: 'AED' });
      });
    });

    describe('When totals is not an object', () => {
      it('Then totals is left out', async () => {
        mockFetch.mockReturnValue(jsonOk({ totals: 5, towers: [], units: [] }));
        const res = await inventoryService.getCategoryAvailability('proj-1');
        expect(res).not.toHaveProperty('totals');
      });
    });
  });

  describe('Given a unit and a manual status', () => {
    describe('When setUnitStatusOverride is called with a reason', () => {
      it('Then it PATCHes the unit status route with the trimmed reason and returns the result', async () => {
        const result = { item_id: 'u1', status_override: 'blocked', status_override_reason: 'Owner hold', status_override_at: '2026-09-28T00:00:00Z' };
        mockFetch.mockReturnValue(jsonOk(result));
        await expect(inventoryService.setUnitStatusOverride('u1', 'blocked', '  Owner hold  ')).resolves.toEqual(result);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/property\/org-1\/units\/u1\/status$/);
        expect(init.method).toBe('PATCH');
        expect(JSON.parse(init.body)).toEqual({ override: 'blocked', reason: 'Owner hold' });
      });
    });

    describe('When the reason is blank or missing', () => {
      it('Then only the override is sent', async () => {
        mockFetch.mockReturnValue(jsonOk({}));
        await inventoryService.setUnitStatusOverride('u1', 'cancelled', '   ');
        await inventoryService.setUnitStatusOverride('u1', 'unavailable');
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ override: 'cancelled' });
        expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ override: 'unavailable' });
      });
    });

    describe('When the override is cleared with null', () => {
      it('Then override null is sent and any reason is dropped', async () => {
        mockFetch.mockReturnValue(jsonOk({ item_id: 'u1', status_override: null }));
        await inventoryService.setUnitStatusOverride('u1', null, 'ignored');
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ override: null });
      });
    });

    describe('When the catalog was cached before the override', () => {
      it('Then the next catalog read goes back to the network', async () => {
        mockFetch.mockReturnValue(jsonOk({ data: [] }));
        await inventoryService.getItems();
        await inventoryService.getItems();
        expect(mockFetch).toHaveBeenCalledTimes(1);
        await inventoryService.setUnitStatusOverride('u1', 'blocked');
        await inventoryService.getItems();
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    });

    describe('When the backend rejects it', () => {
      it('Then the backend message is thrown', async () => {
        mockFetch.mockReturnValue(jsonFail(409, { message: 'Unit is sold' }));
        await expect(inventoryService.setUnitStatusOverride('u1', 'blocked')).rejects.toThrow('Unit is sold');
      });
    });
  });

  describe('Given a developer partner id', () => {
    const partner = {
      id: 'p1', name: 'Emaar', business_name: 'Emaar Properties PJSC', email: 'info@emaar.ae',
      metadata: { website: 'https://emaar.com', logo_url: 'https://cdn/x.png', account_manager_name: 'Sara' },
      is_active: true,
    };

    describe('When getDeveloper is called and contacts are readable', () => {
      it('Then it reads the partner and picks the primary contact', async () => {
        mockFetch.mockImplementation((url: string) =>
          url.includes('/contacts')
            ? jsonOk([{ contact_name: 'Other' }, { contact_name: 'Ali', contact_phone: '+971', is_primary: true }])
            : jsonOk(partner),
        );
        const dev = await inventoryService.getDeveloper('p 1');
        expect(dev).toMatchObject({
          id: 'p1', name: 'Emaar', company: 'Emaar Properties PJSC', contact_name: 'Ali', phone: '+971',
          website: 'https://emaar.com', logo_url: 'https://cdn/x.png', account_manager: 'Sara', status: 'active',
        });
        const urls = mockFetch.mock.calls.map((c) => c[0]);
        expect(urls.some((u: string) => u.endsWith('/v1/partners/details/p%201'))).toBe(true);
        expect(urls.some((u: string) => u.endsWith('/v1/partners/p%201/contacts?org_id=org-1'))).toBe(true);
        const init = mockFetch.mock.calls[0][1];
        expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Org-Id': 'org-1', 'X-Tenant-Id': 't-1' });
      });
    });

    describe('When contacts come in a data envelope without a primary', () => {
      it('Then the first contact is used', async () => {
        mockFetch.mockImplementation((url: string) =>
          url.includes('/contacts') ? jsonOk({ data: [{ contact_name: 'First' }] }) : jsonOk(partner),
        );
        await expect(inventoryService.getDeveloper('p1')).resolves.toMatchObject({ contact_name: 'First' });
      });
    });

    describe('When the contacts read fails or is not a list', () => {
      it('Then the developer still loads without a contact', async () => {
        mockFetch.mockImplementation((url: string) =>
          url.includes('/contacts') ? jsonFail(403, {}) : jsonOk(partner),
        );
        await expect(inventoryService.getDeveloper('p1')).resolves.toMatchObject({ name: 'Emaar', contact_name: null });
        mockFetch.mockImplementation((url: string) =>
          url.includes('/contacts') ? jsonOk({ data: 'nope' }) : jsonOk(partner),
        );
        await expect(inventoryService.getDeveloper('p1')).resolves.toMatchObject({ contact_name: null });
      });
    });

    describe('When the partner read fails', () => {
      it('Then the error propagates', async () => {
        mockFetch.mockImplementation((url: string) => (url.includes('/contacts') ? jsonOk([]) : jsonFail(404, {})));
        await expect(inventoryService.getDeveloper('p1')).rejects.toThrow('Request failed (404)');
      });
    });

    describe('When no org is set', () => {
      it('Then it throws without calling Core', async () => {
        inventoryService.setOrgId('');
        await expect(inventoryService.getDeveloper('p1')).rejects.toThrow('OrgId not set');
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });
});

describe('inventoryService developer roles, developer edit and unit allocation (G1/RE)', () => {
  describe('Given developers and property owners in Core', () => {
    describe('When searchDevelopers is called', () => {
      it('Then both roles are fetched, tagged, and a partner in both is kept as a developer', async () => {
        mockFetch.mockImplementation((url: string) =>
          url.includes('type=property_owner')
            ? jsonOk({ data: [{ id: 'p1', name: 'Emaar' }, { id: 'o1', name: 'Mr Khan' }] })
            : jsonOk({ data: [{ id: 'p1', name: 'Emaar' }] }),
        );
        const res = await inventoryService.searchDevelopers('k');
        expect(res).toEqual([
          { id: 'p1', name: 'Emaar', role: 'developer' },
          { id: 'o1', name: 'Mr Khan', role: 'property_owner' },
        ]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[1][0]).toContain('search=k');
      });
    });

    describe('When the property-owner lookup fails', () => {
      it('Then developers are still returned', async () => {
        mockFetch.mockImplementation((url: string) =>
          url.includes('type=property_owner') ? jsonFail(400, {}) : jsonOk([{ id: 'p1', name: 'Emaar' }]),
        );
        await expect(inventoryService.searchDevelopers()).resolves.toEqual([{ id: 'p1', name: 'Emaar', role: 'developer' }]);
      });
    });
  });

  describe('Given a developer edit', () => {
    describe('When updateDeveloper is called with some blank fields', () => {
      it('Then only trimmed non-blank fields are PATCHed to the Core partner', async () => {
        mockFetch.mockReturnValue(jsonOk({ id: 'p 1' }));
        const res = await inventoryService.updateDeveloper('p 1', {
          website: ' https://emaar.com ', logo_url: '  ', status: 'inactive', account_manager_user_id: undefined,
        });
        expect(res).toEqual({ id: 'p 1' });
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/v1\/partners\/p%201$/);
        expect(init.method).toBe('PATCH');
        expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Org-Id': 'org-1', 'X-Tenant-Id': 't-1', 'Content-Type': 'application/json' });
        expect(JSON.parse(init.body)).toEqual({ website: 'https://emaar.com', status: 'inactive' });
      });
    });

    describe('When Core refuses the write', () => {
      it('Then the status is surfaced as an error', async () => {
        mockFetch.mockReturnValue(jsonFail(403, {}));
        await expect(inventoryService.updateDeveloper('p1', { website: 'x' })).rejects.toThrow('Request failed (403)');
      });
    });

    describe('When Core replies with no JSON body', () => {
      it('Then the result is null', async () => {
        mockFetch.mockReturnValue(Promise.resolve({ ok: true, status: 204, json: () => Promise.reject(new Error('empty')) } as any));
        await expect(inventoryService.updateDeveloper('p1', { account_manager_user_id: 'u1' })).resolves.toBeNull();
      });
    });

    describe('When Core answers 402 quota exceeded', () => {
      it('Then the shell quota event fires and the call fails', async () => {
        const heard = vi.fn();
        window.addEventListener('__so360_quota_exceeded', heard);
        mockFetch.mockReturnValue(Promise.resolve({
          ok: false, status: 402, json: () => Promise.resolve({}), clone: () => ({ json: () => Promise.resolve({}) }),
        } as any));
        await expect(inventoryService.updateDeveloper('p1', { website: 'x' })).rejects.toThrow('Request failed (402)');
        window.removeEventListener('__so360_quota_exceeded', heard);
        expect(heard).toHaveBeenCalled();
      });
    });

    describe('When no org is set', () => {
      it('Then it throws without calling Core', async () => {
        inventoryService.setOrgId('');
        await expect(inventoryService.updateDeveloper('p1', { website: 'x' })).rejects.toThrow('OrgId not set');
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given a unit with an agent override in custom_attributes', () => {
    describe('When getUnitAllocation is called', () => {
      it('Then ids are read from a data envelope and junk entries are dropped', async () => {
        mockFetch.mockReturnValue(jsonOk({ data: { custom_attributes: { assigned_user_ids: ['u1', '', 3], assigned_team_ids: [] } } }));
        await expect(inventoryService.getUnitAllocation('i1')).resolves.toEqual({ assigned_user_ids: ['u1'], assigned_team_ids: null });
        expect(mockFetch.mock.calls[0][0]).toMatch(/\/items\/detail\/i1$/);
      });

      it('Then a bare item and a missing custom_attributes both read as no override', async () => {
        mockFetch.mockReturnValue(jsonOk({ custom_attributes: { assigned_team_ids: ['t1'], assigned_user_ids: 'x' } }));
        await expect(inventoryService.getUnitAllocation('i1')).resolves.toEqual({ assigned_user_ids: null, assigned_team_ids: ['t1'] });
        mockFetch.mockReturnValue(jsonOk({ id: 'i1' }));
        await expect(inventoryService.getUnitAllocation('i1')).resolves.toEqual({ assigned_user_ids: null, assigned_team_ids: null });
        mockFetch.mockReturnValue(jsonOk(null));
        await expect(inventoryService.getUnitAllocation('i1')).resolves.toEqual({ assigned_user_ids: null, assigned_team_ids: null });
      });
    });

    describe('When setUnitAllocation is called', () => {
      it('Then the current attributes are merged and empty lists are stored as null', async () => {
        mockFetch
          .mockReturnValueOnce(jsonOk({ data: { custom_attributes: { bedrooms: 2, assigned_team_ids: ['old'] } } }))
          .mockReturnValueOnce(jsonOk({ id: 'i1' }));
        const out = await inventoryService.setUnitAllocation('i1', { assigned_user_ids: ['u1'], assigned_team_ids: [] });
        expect(out).toEqual({ id: 'i1' });
        const [url, init] = mockFetch.mock.calls[1];
        expect(url).toMatch(/\/items\/i1$/);
        expect(init.method).toBe('PATCH');
        expect(JSON.parse(init.body)).toEqual({
          custom_attributes: { bedrooms: 2, assigned_user_ids: ['u1'], assigned_team_ids: null },
        });
      });

      it('Then an item without attributes gets only the override keys, and null lists clear it', async () => {
        mockFetch
          .mockReturnValueOnce(jsonOk({ custom_attributes: 'bad' }))
          .mockReturnValueOnce(jsonOk({}));
        await inventoryService.setUnitAllocation('i1', { assigned_user_ids: null, assigned_team_ids: ['t1'] });
        expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
          custom_attributes: { assigned_user_ids: null, assigned_team_ids: ['t1'] },
        });
        mockFetch.mockReset();
        mockFetch
          .mockReturnValueOnce(jsonOk(null))
          .mockReturnValueOnce(jsonOk({}));
        await inventoryService.setUnitAllocation('i1', { assigned_user_ids: null, assigned_team_ids: null });
        expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
          custom_attributes: { assigned_user_ids: null, assigned_team_ids: null },
        });
      });

      it('Then the cached item catalogue is dropped so the next read is fresh', async () => {
        mockFetch.mockReturnValue(jsonOk({ data: [] }));
        await inventoryService.getItems();
        await inventoryService.getItems();
        expect(mockFetch).toHaveBeenCalledTimes(1);
        mockFetch.mockReturnValueOnce(jsonOk({})).mockReturnValueOnce(jsonOk({}));
        await inventoryService.setUnitAllocation('i1', { assigned_user_ids: ['u1'], assigned_team_ids: null });
        mockFetch.mockReturnValue(jsonOk({ data: [] }));
        await inventoryService.getItems();
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });
    });
  });
});
