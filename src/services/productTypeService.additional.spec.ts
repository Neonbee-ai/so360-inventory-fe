/**
 * Additional unit tests for productTypeService — edge cases and error paths
 * supplementing the existing productTypeService.spec.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { productTypeService } from './productTypeService';
import { inventoryService } from './inventoryService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok-abc');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const jsonFail = (status: number, message: string) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) } as any);

const jsonFailUnparseable = () =>
  Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse err')) } as any);

describe('productTypeService — additional coverage', () => {
  describe('Given getAll', () => {
    it('When called / Then fetches product types for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'pt1', name: 'Electronics' }]));
      const result = await productTypeService.getAll();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1');
      expect(result[0].id).toBe('pt1');
    });

    it('When API returns empty array / Then returns empty array', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      const result = await productTypeService.getAll();
      expect(result).toEqual([]);
    });

    it('When API fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(500, 'Internal server error'));
      await expect(productTypeService.getAll()).rejects.toThrow('Internal server error');
    });
  });

  describe('Given getOne', () => {
    it('When called with id / Then fetches specific product type', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt1', name: 'Electronics', attributes: [] }));
      const result = await productTypeService.getOne('pt1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1');
      expect(result.id).toBe('pt1');
    });

    it('When called with nonexistent id / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Product type not found'));
      await expect(productTypeService.getOne('nonexistent')).rejects.toThrow('Product type not found');
    });
  });

  describe('Given create', () => {
    it('When called with required fields / Then sends POST with data', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt2', name: 'Clothing' }));
      const dto = { name: 'Clothing', code: 'CLO', description: 'Apparel items' };
      const result = await productTypeService.create(dto);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.name).toBe('Clothing');
      expect(body.code).toBe('CLO');
      expect(result.name).toBe('Clothing');
    });

    it('When API fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Duplicate product type code'));
      await expect(productTypeService.create({ name: 'Dup', code: 'DUP' })).rejects.toThrow('Duplicate product type code');
    });

    it('When API fails with unparseable error / Then throws generic error', async () => {
      mockFetch.mockReturnValue(jsonFailUnparseable());
      await expect(productTypeService.create({ name: 'X', code: 'X' })).rejects.toThrow();
    });
  });

  describe('Given update', () => {
    it('When called with id and partial data / Then sends PATCH', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt1', name: 'Updated Electronics' }));
      const result = await productTypeService.update('pt1', { name: 'Updated Electronics' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1');
      expect(opts.method).toBe('PATCH');
      expect(result.name).toBe('Updated Electronics');
    });

    it('When update fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Not found'));
      await expect(productTypeService.update('nonexistent', {})).rejects.toThrow('Not found');
    });

    it('When setting is_active to false / Then sends correct payload', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt1', is_active: false }));
      await productTypeService.update('pt1', { is_active: false });
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.is_active).toBe(false);
    });
  });

  describe('Given delete', () => {
    it('When called / Then sends DELETE', async () => {
      mockFetch.mockReturnValue(jsonOk({ deleted: true }));
      const result = await productTypeService.delete('pt1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1');
      expect(opts.method).toBe('DELETE');
      expect(result).toEqual({ deleted: true });
    });

    it('When deletion fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(409, 'Cannot delete type in use'));
      await expect(productTypeService.delete('pt1')).rejects.toThrow('Cannot delete type in use');
    });
  });

  describe('Given addAttribute', () => {
    it('When called / Then sends POST to attributes endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'attr1', field_name: 'color' }));
      const attr = { field_name: 'color', label: 'Color', field_type: 'text', is_required: false, sort_order: 0 };
      const result = await productTypeService.addAttribute('pt1', attr);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes');
      expect(opts.method).toBe('POST');
      expect(result.field_name).toBe('color');
    });

    it('When attribute already exists / Then throws conflict error', async () => {
      mockFetch.mockReturnValue(jsonFail(409, 'Attribute field_name already exists'));
      await expect(productTypeService.addAttribute('pt1', { field_name: 'color' })).rejects.toThrow('Attribute field_name already exists');
    });
  });

  describe('Given updateAttribute', () => {
    it('When called / Then sends PATCH to specific attribute endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'attr1', label: 'Colour (UK)' }));
      const result = await productTypeService.updateAttribute('pt1', 'attr1', { label: 'Colour (UK)' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes/attr1');
      expect(opts.method).toBe('PATCH');
      expect(result.label).toBe('Colour (UK)');
    });

    it('When attribute not found / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Attribute not found'));
      await expect(productTypeService.updateAttribute('pt1', 'nonexistent', {})).rejects.toThrow('Attribute not found');
    });
  });

  describe('Given deleteAttribute', () => {
    it('When called / Then sends DELETE to attribute endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await productTypeService.deleteAttribute('pt1', 'attr1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes/attr1');
      expect(opts.method).toBe('DELETE');
    });

    it('When deletion fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(403, 'Cannot delete required attribute'));
      await expect(productTypeService.deleteAttribute('pt1', 'attr1')).rejects.toThrow('Cannot delete required attribute');
    });

    it('When attribute not found / Then throws 404', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Attribute not found'));
      await expect(productTypeService.deleteAttribute('pt1', 'missing')).rejects.toThrow('Attribute not found');
    });
  });

  describe('Given request headers', () => {
    it('When any request is made / Then includes auth and tenant headers from inventoryService', async () => {
      mockFetch.mockReturnValue(jsonOk([]));
      await productTypeService.getAll();
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer tok-abc');
      expect(opts.headers['X-Tenant-Id']).toBe('t-1');
      expect(opts.headers['X-Org-Id']).toBe('org-1');
    });
  });
});
