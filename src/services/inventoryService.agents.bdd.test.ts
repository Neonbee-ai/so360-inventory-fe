/**
 * inventoryService agent pickers — org users from Core's directory and teams
 * (People Connect departments) for project/tower/unit agent assignment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as any);
const jsonFail = (status: number) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as any);

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
  delete (window as any).VITE_SO360_PEOPLE_API;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).VITE_SO360_PEOPLE_API;
});

describe('Given an org is set', () => {
  describe('When searchOrgUsers is called without text', () => {
    it('Then it reads Core directory search for the org with auth headers and keeps only Core users', async () => {
      mockFetch.mockReturnValue(jsonOk({
        data: [
          { id: 'u1', full_name: 'Aisha Khan', email: 'aisha@x.com', source: 'core_user' },
          { id: 'u2', email: 'bob@x.com' },
          { id: 'u3' },
          { id: 'p1', full_name: 'Person Only', source: 'people_connect' },
          { full_name: 'No id' },
          null,
        ],
      }));
      const res = await inventoryService.searchOrgUsers();
      expect(res).toEqual([
        { id: 'u1', name: 'Aisha Khan', detail: 'aisha@x.com' },
        { id: 'u2', name: 'bob@x.com', detail: 'bob@x.com' },
        { id: 'u3', name: 'u3', detail: undefined },
      ]);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/v1\/directory\/search\?org_id=org-1&limit=50$/);
      expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Tenant-Id': 't-1', 'X-Org-Id': 'org-1' });
    });
  });

  describe('When searchOrgUsers is called with text', () => {
    it('Then the trimmed text is sent as q', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'u1', full_name: 'Aisha' }]));
      const res = await inventoryService.searchOrgUsers('  ais ');
      expect(res).toEqual([{ id: 'u1', name: 'Aisha', detail: undefined }]);
      expect(mockFetch.mock.calls[0][0]).toMatch(/org_id=org-1&limit=50&q=ais$/);
    });

    it('Then blank text sends no q and an unexpected body yields no users', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: 'nope' }));
      await expect(inventoryService.searchOrgUsers('   ')).resolves.toEqual([]);
      expect(mockFetch.mock.calls[0][0]).not.toMatch(/q=/);
      mockFetch.mockReturnValue(jsonOk(null));
      await expect(inventoryService.searchOrgUsers()).resolves.toEqual([]);
    });
  });

  describe('When Core rejects the directory search', () => {
    it('Then the error propagates', async () => {
      mockFetch.mockReturnValue(jsonFail(403));
      await expect(inventoryService.searchOrgUsers()).rejects.toThrow('Request failed (403)');
    });
  });
});

describe('Given no org is set', () => {
  it('Then searchOrgUsers throws without calling Core', async () => {
    inventoryService.setOrgId('');
    await expect(inventoryService.searchOrgUsers('a')).rejects.toThrow('OrgId not set');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Given People Connect departments', () => {
  describe('When listTeams is called with the shell-injected People origin', () => {
    it('Then it reads /departments from that origin and maps name, code and id', async () => {
      (window as any).VITE_SO360_PEOPLE_API = 'https://people.example/';
      mockFetch.mockReturnValue(jsonOk({
        data: [
          { id: 'd1', name: 'Sales', code: 'SAL' },
          { id: 'd2', code: 'OPS' },
          { id: 'd3' },
          { name: 'no id' },
        ],
        total: 3,
      }));
      const res = await inventoryService.listTeams();
      expect(res).toEqual([
        { id: 'd1', name: 'Sales', detail: 'SAL' },
        { id: 'd2', name: 'OPS', detail: 'OPS' },
        { id: 'd3', name: 'd3', detail: undefined },
      ]);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://people.example/departments?limit=100');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Org-Id': 'org-1' });
    });
  });

  describe('When no People origin is injected', () => {
    it('Then it falls back to the local People Connect port and accepts a bare array', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'd1', name: 'Sales' }]));
      await expect(inventoryService.listTeams()).resolves.toEqual([{ id: 'd1', name: 'Sales', detail: undefined }]);
      expect(mockFetch.mock.calls[0][0]).toMatch(/\/departments\?limit=100$/);
    });

    it('Then an unexpected body yields no teams', async () => {
      mockFetch.mockReturnValue(jsonOk({ data: { nope: true } }));
      await expect(inventoryService.listTeams()).resolves.toEqual([]);
    });
  });

  describe('When People Connect refuses (no departments.read)', () => {
    it('Then the error propagates so the picker can fall back', async () => {
      mockFetch.mockReturnValue(jsonFail(403));
      await expect(inventoryService.listTeams()).rejects.toThrow('Request failed (403)');
    });
  });
});
