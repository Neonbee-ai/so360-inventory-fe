import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
});
const ok = (body: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

describe('inventoryService.searchHsnSac', () => {
  it('Given a query and kind / Then it calls the inventory proxy with the params and the caller headers', async () => {
    mockFetch.mockReturnValue(ok({ data: [], total: 0 }));
    await inventoryService.searchHsnSac({ q: 'furn', kind: 'goods', page_size: 20 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/v1/inventory/hsn-sac?');
    expect(String(url)).toContain('q=furn');
    expect(String(url)).toContain('kind=goods');
    expect(String(url)).toContain('page_size=20');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['X-Org-Id']).toBe('org-1');
  });
  it('Given blank params / Then they are left out of the URL', async () => {
    mockFetch.mockReturnValue(ok({ data: [] }));
    await inventoryService.searchHsnSac({ q: '', kind: undefined });
    expect(String(mockFetch.mock.calls[0][0]).endsWith('/v1/inventory/hsn-sac')).toBe(true);
  });
  it('Given no params at all / Then it still calls the endpoint', async () => {
    mockFetch.mockReturnValue(ok({ data: [] }));
    await inventoryService.searchHsnSac();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
