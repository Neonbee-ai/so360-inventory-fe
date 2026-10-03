import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService, toScannedItem } from './inventoryService';

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

describe('inventoryService loss & yield', () => {
    describe('Given stock counts', () => {
        it('When listed as a bare array (server shape) Then the rows are returned', async () => {
            mockFetch.mockReturnValue(jsonOk([{ id: 'c-1', warehouse_id: 'w-1', status: 'draft' }]));
            expect(await inventoryService.getStockCounts()).toEqual([{ id: 'c-1', warehouse_id: 'w-1', status: 'draft' }]);
        });

        it('When one count is fetched Then header, total_variance_value and lines come back', async () => {
            const body = {
                id: 'c-1', warehouse_id: 'w-1', status: 'draft', total_variance_value: -4,
                lines: [{ id: 'l-1', item_id: 'p-1', variant_id: 'v-1', expected_qty: 5, actual_qty: 3, variance_qty: -2, variance_value: -4, item_name: 'A', sku: 'A-1' }],
            };
            mockFetch.mockReturnValue(jsonOk(body));
            const c = await inventoryService.getStockCount('c-1');
            expect(c.total_variance_value).toBe(-4);
            expect(c.lines?.[0]).toMatchObject({ item_id: 'p-1', variant_id: 'v-1', variance_qty: -2 });
        });

        it('When listed with a {data} envelope Then the rows are unwrapped and tenancy headers sent', async () => {
            mockFetch.mockReturnValue(jsonOk({ data: [{ id: 'c-1' }] }));
            const res = await inventoryService.getStockCounts({ status: 'draft' });
            expect(res).toEqual([{ id: 'c-1' }]);
            const [url, init] = mockFetch.mock.calls[0];
            expect(url).toMatch(/\/v1\/stock-counts\?status=draft$/);
            expect(init.headers['X-Org-Id']).toBe('org-1');
            expect(init.headers['X-Tenant-Id']).toBe('t-1');
            expect(init.headers.Authorization).toBe('Bearer tok');
        });

        it('When created Then it POSTs warehouse and date', async () => {
            mockFetch.mockReturnValue(jsonOk({ id: 'c-2' }));
            await inventoryService.createStockCount({ warehouse_id: 'w-1', count_date: '2026-10-03' });
            const [url, init] = mockFetch.mock.calls[0];
            expect(url).toMatch(/\/v1\/stock-counts$/);
            expect(init.method).toBe('POST');
            expect(JSON.parse(init.body)).toEqual({ warehouse_id: 'w-1', count_date: '2026-10-03' });
        });

        it('When lines are saved Then it PATCHes /stock-counts/:id', async () => {
            mockFetch.mockReturnValue(jsonOk({ id: 'c-1' }));
            const lines = [{ item_id: 'i-1', actual_qty: 3, reason_code: 'SPOIL' }];
            await inventoryService.updateStockCount('c-1', { lines });
            const [url, init] = mockFetch.mock.calls[0];
            expect(url).toMatch(/\/v1\/stock-counts\/c-1$/);
            expect(init.method).toBe('PATCH');
            expect(JSON.parse(init.body)).toEqual({ lines });
        });

        it('When posting an already-posted count Then the error carries status 409', async () => {
            mockFetch.mockReturnValue(jsonFail(409, { message: 'Stock count already posted' }));
            await expect(inventoryService.postStockCount('c-1')).rejects.toMatchObject({
                message: 'Stock count already posted', status: 409,
            });
            expect(mockFetch.mock.calls[0][0]).toMatch(/\/v1\/stock-counts\/c-1\/post$/);
        });
    });

    describe('Given conversions and loss reports', () => {
        it('When a conversion is recorded Then the DTO incl. client_ref and variant outputs is POSTed unchanged', async () => {
            mockFetch.mockReturnValue(jsonOk({ id: 'x-1' }));
            const dto = {
                client_ref: '11111111-2222-4333-8444-555555555555',
                warehouse_id: 'w-1', conversion_date: '2026-10-03', input_item_id: 'v-in', input_qty: 10,
                outputs: [{ item_id: 'o-1', variant_id: null, qty: 5 }, { item_id: 'p-2', variant_id: 'v-2', qty: 3 }],
                loss_qty: 2,
            };
            await inventoryService.createStockConversion(dto);
            const [url, init] = mockFetch.mock.calls[0];
            expect(url).toMatch(/\/v1\/stock-conversions$/);
            expect(JSON.parse(init.body)).toEqual(dto);
        });

        it('When the loss summary is requested Then from, to and group_by are in the query', async () => {
            mockFetch.mockReturnValue(jsonOk({ total_value: 0, total_qty: 0, rows: [], trend: [] }));
            await inventoryService.getLossSummary({ from: '2026-09-01', to: '2026-09-30', group_by: 'category' });
            expect(mockFetch.mock.calls[0][0]).toMatch(/\/v1\/loss\/summary\?from=2026-09-01&to=2026-09-30&group_by=category$/);
        });

        it('When loss reasons come back as an array Then they are returned as-is', async () => {
            mockFetch.mockReturnValue(jsonOk([{ code: 'TRIM' }]));
            expect(await inventoryService.getLossReasons()).toEqual([{ code: 'TRIM' }]);
        });
    });

    describe('Given a barcode lookup', () => {
        it('When no item matches (404) Then it resolves null', async () => {
            mockFetch.mockReturnValue(jsonFail(404, { message: 'Not found' }));
            expect(await inventoryService.getItemByCode('000')).toBeNull();
        });

        it('When the server fails otherwise Then it throws', async () => {
            mockFetch.mockReturnValue(jsonFail(500, { message: 'Boom' }));
            await expect(inventoryService.getItemByCode('000')).rejects.toThrow('Boom');
        });

        it('When the code has special characters Then it is URL-encoded', async () => {
            mockFetch.mockReturnValue(jsonOk({ id: 'i-1', name: 'A' }));
            await inventoryService.getItemByCode('A/B 1');
            expect(mockFetch.mock.calls[0][0]).toMatch(/\/v1\/items\/by-code\/A%2FB%201$/);
        });

        it('When the payload is {item, variant} Then variant sku and id are used', () => {
            expect(toScannedItem({ item: { id: 'i-1', name: 'A', sku: 'X' }, variant: { id: 'v-1', sku: 'X-L' }, matched_on: 'barcode' }))
                .toMatchObject({ id: 'i-1', name: 'A', sku: 'X-L', variant_id: 'v-1', matched_on: 'barcode' });
        });

        it('When the server returns {item, variant: null, matched_on} Then the item is the stock row', async () => {
            mockFetch.mockReturnValue(jsonOk({ item: { id: 'i-9', name: 'Loose', sku: 'L-9' }, variant: null, matched_on: 'sku' }));
            expect(await inventoryService.getItemByCode('L-9'))
                .toMatchObject({ id: 'i-9', name: 'Loose', sku: 'L-9', variant_id: null, matched_on: 'sku' });
        });

        it('When the payload is a flat item Then it maps directly', () => {
            expect(toScannedItem({ id: 'i-1', name: 'A', sku: 'X' })).toMatchObject({ id: 'i-1', sku: 'X', variant_id: null });
            expect(toScannedItem(null)).toBeNull();
        });
    });
});
