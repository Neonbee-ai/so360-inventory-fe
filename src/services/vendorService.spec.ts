import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vendorService } from './vendorService';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
  vendorService.setUserId('user-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const jsonFail = (status: number, message: string) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) } as any);

describe('vendorService', () => {
  describe('Given setUserId', () => {
    it('When setUserId called / Then userId is included in requests', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      vendorService.setUserId('user-42');
      await vendorService.getVendors();
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['x-user-id']).toBe('user-42');
    });
  });

  describe('Given getVendors', () => {
    it('When called / Then fetches vendors for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'v1', name: 'Vendor One' }]));
      const result = await vendorService.getVendors();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/org-1');
      expect(result[0].id).toBe('v1');
    });

    it('When API fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(500, 'Server error'));
      await expect(vendorService.getVendors()).rejects.toThrow('Server error');
    });
  });

  describe('Given createVendor', () => {
    it('When called with dto / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'v2' }));
      const dto = { name: 'New Vendor', email: 'new@vendor.com' };
      const result = await vendorService.createVendor(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/v1/vendors');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(dto);
      expect(result.id).toBe('v2');
    });

    it('When creation fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Duplicate vendor'));
      await expect(vendorService.createVendor({ name: 'Dup' })).rejects.toThrow('Duplicate vendor');
    });
  });

  describe('Given getVendorDetail', () => {
    it('When called with id / Then fetches vendor detail', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'v1', name: 'Vendor One' }));
      const result = await vendorService.getVendorDetail('v1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/detail/v1');
      expect(result.name).toBe('Vendor One');
    });
  });

  describe('Given updateVendor', () => {
    it('When called / Then sends PATCH with dto', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'v1', name: 'Updated Vendor' }));
      await vendorService.updateVendor('v1', { name: 'Updated Vendor' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/v1');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ name: 'Updated Vendor' });
    });
  });

  describe('Given deleteVendor', () => {
    it('When called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await vendorService.deleteVendor('v1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/v1');
      expect(opts.method).toBe('DELETE');
    });

    it('When API fails with no message / Then throws generic error', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) } as any)
      );
      await expect(vendorService.deleteVendor('v1')).rejects.toThrow('API Request failed');
    });
  });

  describe('Given getContracts', () => {
    it('When called / Then fetches contracts for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'c1' }]));
      const result = await vendorService.getContracts();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/contracts/org-1');
      expect(result[0].id).toBe('c1');
    });
  });

  describe('Given createContract', () => {
    it('When called with dto / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'c2' }));
      const dto = { vendor_id: 'v1', title: 'Contract A', start_date: '2024-01-01' };
      await vendorService.createContract(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/v1/vendors/contracts');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(dto);
    });
  });

  describe('Given rateVendor', () => {
    it('When called with rating / Then sends POST with rating payload', async () => {
      mockFetch.mockReturnValue(jsonOk({ success: true }));
      await vendorService.rateVendor('v1', 4);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/v1/rate');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ rating: 4 });
    });
  });

  describe('Given getVendorRating', () => {
    it('When called / Then fetches rating for vendor', async () => {
      mockFetch.mockReturnValue(jsonOk({ average: 4.5, count: 10 }));
      const result = await vendorService.getVendorRating('v1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/vendors/v1/rating');
      expect(result.average).toBe(4.5);
    });
  });

  describe('Given request headers', () => {
    it('When request made / Then includes Authorization, X-Tenant-Id, X-Org-Id headers', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      await vendorService.getVendors();
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer tok');
      expect(opts.headers['X-Tenant-Id']).toBe('t-1');
      expect(opts.headers['X-Org-Id']).toBe('org-1');
      expect(opts.headers['Content-Type']).toBe('application/json');
    });
  });
});
