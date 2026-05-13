import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { procurementService } from './procurementService';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const jsonFail = (status: number, message: string) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) } as any);

describe('procurementService', () => {
  describe('Given getPRs', () => {
    it('When called / Then fetches PRs for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'pr1' }]));
      const result = await procurementService.getPRs();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr/org-1');
      expect(result[0].id).toBe('pr1');
    });

    it('When API fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(500, 'Server error'));
      await expect(procurementService.getPRs()).rejects.toThrow('Server error');
    });
  });

  describe('Given createPR', () => {
    it('When called with dto / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pr2' }));
      const dto = { title: 'New PR', items: [] };
      await procurementService.createPR(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(dto);
    });
  });

  describe('Given getPRDetail', () => {
    it('When called with id / Then fetches PR detail', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pr1', status: 'pending' }));
      const result = await procurementService.getPRDetail('pr1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr/detail/pr1');
      expect(result.status).toBe('pending');
    });
  });

  describe('Given approvePR', () => {
    it('When called / Then sends PATCH to approve endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pr1', status: 'approved' }));
      const approvalDto = { approved_by: 'user-1', notes: 'Approved' };
      await procurementService.approvePR('pr1', approvalDto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr/pr1/approve');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual(approvalDto);
    });
  });

  describe('Given getConversionPayload', () => {
    it('When called with prId / Then sends POST to convert-to-po', async () => {
      mockFetch.mockReturnValue(jsonOk({ po_data: {} }));
      await procurementService.getConversionPayload('pr1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr/pr1/convert-to-po');
      expect(opts.method).toBe('POST');
    });
  });

  describe('Given closePR', () => {
    it('When called / Then sends PATCH to close', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pr1', status: 'closed' }));
      await procurementService.closePR('pr1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr/pr1/close');
      expect(opts.method).toBe('PATCH');
    });
  });

  describe('Given deletePR', () => {
    it('When called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await procurementService.deletePR('pr1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/pr/pr1');
      expect(opts.method).toBe('DELETE');
    });

    it('When API fails with no message / Then throws generic error', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) } as any)
      );
      await expect(procurementService.deletePR('pr1')).rejects.toThrow('API Request failed');
    });
  });

  describe('Given getPOs', () => {
    it('When called / Then fetches POs for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'po1' }]));
      const result = await procurementService.getPOs();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/po/org-1');
      expect(result[0].id).toBe('po1');
    });
  });

  describe('Given createPO', () => {
    it('When called with dto / Then sends POST', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'po2' }));
      const dto = { vendor_id: 'v1', items: [] };
      await procurementService.createPO(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/po');
      expect(opts.method).toBe('POST');
    });
  });

  describe('Given getPODetail', () => {
    it('When called / Then fetches PO detail', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'po1', status: 'open' }));
      const result = await procurementService.getPODetail('po1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/po/detail/po1');
      expect(result.status).toBe('open');
    });
  });

  describe('Given updatePOStatus', () => {
    it('When called / Then sends PATCH with status dto', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'po1', status: 'received' }));
      await procurementService.updatePOStatus('po1', { status: 'received' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/po/po1/status');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ status: 'received' });
    });

    it('When called with reason / Then includes reason in payload', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'po1' }));
      await procurementService.updatePOStatus('po1', { status: 'cancelled', reason: 'No longer needed' });
      const [, opts] = mockFetch.mock.calls[0];
      expect(JSON.parse(opts.body).reason).toBe('No longer needed');
    });
  });

  describe('Given createGRN', () => {
    it('When called with dto / Then sends POST to grn', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'grn1' }));
      const dto = { po_id: 'po1', received_date: '2024-01-01', items: [] };
      await procurementService.createGRN(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/grn');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(dto);
    });
  });

  describe('Given getGRNs', () => {
    it('When called / Then fetches GRNs for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'grn1' }]));
      const result = await procurementService.getGRNs();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/grn/org-1');
      expect(result[0].id).toBe('grn1');
    });
  });

  describe('Given getGRNDetail', () => {
    it('When called / Then fetches GRN detail by id', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'grn1', status: 'complete' }));
      const result = await procurementService.getGRNDetail('grn1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/grn/grn1');
      expect(result.status).toBe('complete');
    });
  });

  describe('Given createVendorInvoice', () => {
    it('When called with dto / Then sends POST to vendor-invoice', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'vi1' }));
      const dto = {
        vendor_id: 'v1',
        invoice_number: 'INV-001',
        invoice_date: '2024-01-15',
        total_amount: 5000,
      };
      await procurementService.createVendorInvoice(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/vendor-invoice');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).invoice_number).toBe('INV-001');
    });
  });

  describe('Given getAnalytics', () => {
    it('When called / Then fetches analytics for org', async () => {
      mockFetch.mockReturnValue(jsonOk({ total_po: 5 }));
      const result = await procurementService.getAnalytics();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/analytics/org-1');
      expect(result.total_po).toBe(5);
    });
  });

  describe('Given createOpeningBalance', () => {
    it('When called with dto / Then sends POST to opening-balance', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'ob1' }));
      const dto = {
        vendor_id: 'v1',
        items: [{ item_id: 'i1', warehouse_id: 'w1', quantity: 10, unit_cost: 100 }],
      };
      await procurementService.createOpeningBalance(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/opening-balance');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).items[0].item_id).toBe('i1');
    });
  });

  describe('Given getUnlinkedMovements', () => {
    it('When called / Then fetches unlinked movements for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'um1' }]));
      const result = await procurementService.getUnlinkedMovements();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/procurement/unlinked-movements/org-1');
      expect(result[0].id).toBe('um1');
    });
  });

  describe('Given request headers', () => {
    it('When request made / Then includes auth and tenant headers', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      await procurementService.getPRs();
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer tok');
      expect(opts.headers['X-Tenant-Id']).toBe('t-1');
      expect(opts.headers['X-Org-Id']).toBe('org-1');
    });
  });
});
