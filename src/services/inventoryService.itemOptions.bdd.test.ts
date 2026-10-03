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
});
afterEach(() => vi.unstubAllGlobals());

describe('inventoryService item options (Daily Store API)', () => {
  describe('Given the option groups list', () => {
    it('When listOptionGroups runs Then it GETs /v1/dailystore/option-groups with tenancy headers and unwraps { data }', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [{ id: 'g1', name: 'Cut' }] }));
      const res = await inventoryService.listOptionGroups();
      expect(res).toEqual([{ id: 'g1', name: 'Cut' }]);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/v1\/dailystore\/option-groups$/);
      expect(init.headers['X-Org-Id']).toBe('org-1');
      expect(init.headers['X-Tenant-Id']).toBe('t-1');
      expect(init.headers.Authorization).toBe('Bearer tok');
    });

    it('When the response is a bare array Then it is returned as-is', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'g2' }]));
      expect(await inventoryService.listOptionGroups()).toEqual([{ id: 'g2' }]);
    });
  });

  describe('Given a group to save', () => {
    it('When createOptionGroup runs Then it POSTs the JSON body', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'g1' }));
      const group: any = { name: 'Cut', selection: 'single', options: [] };
      await inventoryService.createOptionGroup(group);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/v1\/dailystore\/option-groups$/);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual(group);
    });

    it('When updateOptionGroup runs with only applies_to Then the PATCH body carries no options', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'g/1' }));
      await inventoryService.updateOptionGroup('g/1', { applies_to: { item_ids: ['i1'], category_ids: [] } });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/v1\/dailystore\/option-groups\/g%2F1$/);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ applies_to: { item_ids: ['i1'], category_ids: [] } });
    });

    it('When deleteOptionGroup runs Then it sends DELETE without a body', async () => {
      mockFetch.mockReturnValue(jsonOk(null));
      await inventoryService.deleteOptionGroup('g1');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/option-groups\/g1$/);
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
    });

    it('When the server rejects with a validation array Then the messages are surfaced', async () => {
      mockFetch.mockReturnValue(jsonFail(400, { message: ['name is required', 'options too short'] }));
      await expect(inventoryService.createOptionGroup({} as any)).rejects.toThrow('name is required, options too short');
    });

    it('When the server fails without a body Then the status is surfaced', async () => {
      mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 403, json: () => Promise.reject(new Error('x')) } as any));
      await expect(inventoryService.deleteOptionGroup('g1')).rejects.toThrow('Request failed (403)');
    });
  });

  describe('Given capture fields', () => {
    it('When listing/creating/updating/deleting Then each hits /v1/dailystore/measurement-defs', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: [] }));
      await inventoryService.listMeasurementDefs();
      await inventoryService.createMeasurementDef({ key: 'w', label: 'W', unit: 'kg' } as any);
      await inventoryService.updateMeasurementDef('m1', { is_billing_basis: true });
      await inventoryService.deleteMeasurementDef('m1');
      const calls = mockFetch.mock.calls.map(([u, i]) => [String(u).replace(/^.*\/v1\/dailystore/, ''), i?.method ?? 'GET']);
      expect(calls).toEqual([
        ['/measurement-defs', 'GET'],
        ['/measurement-defs', 'POST'],
        ['/measurement-defs/m1', 'PATCH'],
        ['/measurement-defs/m1', 'DELETE'],
      ]);
    });
  });
});
