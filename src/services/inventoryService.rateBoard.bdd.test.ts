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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inventoryService rate board', () => {
  describe('Given a date', () => {
    describe('When getRateBoard is called', () => {
      it('Then it GETs /v1/rate-board/:date with tenancy headers and returns the board', async () => {
        const board = { date: '2026-10-03', entries: [] };
        mockFetch.mockReturnValue(jsonOk(board));
        const res = await inventoryService.getRateBoard('2026-10-03');
        expect(res).toEqual(board);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/v1\/rate-board\/2026-10-03$/);
        expect(url).not.toMatch(/\/v1\/inventory\//);
        expect(init.headers['X-Org-Id']).toBe('org-1');
        expect(init.headers['X-Tenant-Id']).toBe('t-1');
        expect(init.headers.Authorization).toBe('Bearer tok');
      });
    });

    describe('When saveRateBoard is called with entries', () => {
      it('Then it PUTs { entries } as JSON', async () => {
        mockFetch.mockReturnValue(jsonOk({ saved: 1 }));
        const entries = [{ item_id: 'i-1', variant_id: null, price: 12.5, unit: 'kg' }];
        await inventoryService.saveRateBoard('2026-10-03', entries);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/v1\/rate-board\/2026-10-03$/);
        expect(init.method).toBe('PUT');
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(init.body)).toEqual({ entries });
      });
    });

    describe('When copyPreviousRates is called', () => {
      it('Then it POSTs to :date/copy-previous', async () => {
        mockFetch.mockReturnValue(jsonOk({ copied: 3 }));
        await inventoryService.copyPreviousRates('2026-10-03');
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/v1\/rate-board\/2026-10-03\/copy-previous$/);
        expect(init.method).toBe('POST');
      });
    });

    describe('When the backend rejects the save', () => {
      it('Then the server message is surfaced as the error', async () => {
        mockFetch.mockReturnValue(jsonFail(400, { message: 'Unknown item' }));
        await expect(
          inventoryService.saveRateBoard('2026-10-03', [{ item_id: 'x', price: 1 }]),
        ).rejects.toThrow('Unknown item');
      });
    });
  });

  describe('Given an item id and a range', () => {
    describe('When getRateHistory is called', () => {
      it('Then it GETs /v1/rate-board/history with item_id, from and to', async () => {
        mockFetch.mockReturnValue(jsonOk([]));
        await inventoryService.getRateHistory('i-1', '2026-09-01', '2026-10-03');
        const [url] = mockFetch.mock.calls[0];
        const u = new URL(url, 'http://x');
        expect(u.pathname).toMatch(/\/v1\/rate-board\/history$/);
        expect(u.searchParams.get('item_id')).toBe('i-1');
        expect(u.searchParams.get('from')).toBe('2026-09-01');
        expect(u.searchParams.get('to')).toBe('2026-10-03');
      });

      it('Then an omitted range is not sent', async () => {
        mockFetch.mockReturnValue(jsonOk([]));
        await inventoryService.getRateHistory('i-1');
        const u = new URL(mockFetch.mock.calls[0][0], 'http://x');
        expect(u.searchParams.has('from')).toBe(false);
        expect(u.searchParams.has('to')).toBe(false);
      });
    });
  });
});
