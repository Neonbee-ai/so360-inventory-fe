import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { productTypeService } from './productTypeService';
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

describe('productTypeService', () => {
  describe('Given getAll', () => {
    it('When called / Then fetches all product types for org', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'pt1', name: 'Goods' }]));
      const result = await productTypeService.getAll();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1');
      expect(result[0].name).toBe('Goods');
    });

    it('When API fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(500, 'Server error'));
      await expect(productTypeService.getAll()).rejects.toThrow('Server error');
    });
  });

  describe('Given getOne', () => {
    it('When called with id / Then fetches specific product type', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt1', name: 'Goods', code: 'GDS' }));
      const result = await productTypeService.getOne('pt1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1');
      expect(result.code).toBe('GDS');
    });
  });

  describe('Given create', () => {
    it('When called with data / Then sends POST to product-types org endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt2' }));
      const data = { name: 'Service', code: 'SVC', description: 'Service items' };
      await productTypeService.create(data);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(data);
    });

    it('When called without optional fields / Then only required fields in payload', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt3' }));
      await productTypeService.create({ name: 'Raw', code: 'RAW' });
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.name).toBe('Raw');
      expect(body.code).toBe('RAW');
    });

    it('When creation fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(409, 'Duplicate code'));
      await expect(productTypeService.create({ name: 'Dup', code: 'DUP' })).rejects.toThrow('Duplicate code');
    });
  });

  describe('Given update', () => {
    it('When called / Then sends PATCH with partial data', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'pt1', name: 'Updated', is_active: true }));
      await productTypeService.update('pt1', { name: 'Updated', is_active: true });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ name: 'Updated', is_active: true });
    });
  });

  describe('Given delete', () => {
    it('When called / Then sends DELETE for product type', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await productTypeService.delete('pt1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1');
      expect(opts.method).toBe('DELETE');
    });

    it('When delete fails / Then throws error', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Cannot delete type in use'));
      await expect(productTypeService.delete('pt1')).rejects.toThrow('Cannot delete type in use');
    });
  });

  describe('Given addAttribute', () => {
    it('When called / Then sends POST to attributes endpoint', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'attr1' }));
      const attrData = { name: 'Color', type: 'select', options: ['Red', 'Blue'] };
      await productTypeService.addAttribute('pt1', attrData);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(attrData);
    });
  });

  describe('Given updateAttribute', () => {
    it('When called / Then sends PATCH to specific attribute', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'attr1', name: 'Size' }));
      await productTypeService.updateAttribute('pt1', 'attr1', { name: 'Size' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes/attr1');
      expect(opts.method).toBe('PATCH');
    });
  });

  describe('Given deleteAttribute', () => {
    it('When called / Then sends DELETE to specific attribute', async () => {
      mockFetch.mockReturnValue(jsonOk({}));
      await productTypeService.deleteAttribute('pt1', 'attr1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes/attr1');
      expect(opts.method).toBe('DELETE');
    });
  });

  // ── Attribute groups (Task 11) ─────────────────────────────────────────────

  describe('Given getAttributeGroups', () => {
    it('When called / Then fetches the groups of that product type', async () => {
      mockFetch.mockReturnValue(jsonOk([{ id: 'g1', label: 'Dimensions' }]));
      const result = await productTypeService.getAttributeGroups('pt1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attribute-groups');
      expect(result[0].label).toBe('Dimensions');
    });

    it('When the API fails / Then throws the message', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Product type not found'));
      await expect(productTypeService.getAttributeGroups('pt1')).rejects.toThrow('Product type not found');
    });
  });

  describe('Given createAttributeGroup', () => {
    it('When called / Then posts the label, order and placements', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'g1' }));
      const data = {
        label: 'Material & Finish',
        sort_order: 2,
        placements: { card: true, pdp_specs: true },
      };
      await productTypeService.createAttributeGroup('pt1', data);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attribute-groups');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual(data);
    });
  });

  describe('Given updateAttributeGroup', () => {
    it('When called / Then patches that group', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'g1', label: 'Measurements' }));
      await productTypeService.updateAttributeGroup('pt1', 'g1', {
        label: 'Measurements',
        placements: { card: false },
      });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attribute-groups/g1');
      expect(opts.method).toBe('PATCH');
      // Only the changed surface is sent; the backend merges it onto the stored map.
      expect(JSON.parse(opts.body)).toEqual({ label: 'Measurements', placements: { card: false } });
    });

    it('When the group belongs to another type / Then the 404 message is surfaced', async () => {
      mockFetch.mockReturnValue(jsonFail(404, 'Attribute group not found for this product type'));
      await expect(productTypeService.updateAttributeGroup('pt1', 'g-other', { label: 'x' })).rejects.toThrow(
        'Attribute group not found for this product type',
      );
    });
  });

  describe('Given deleteAttributeGroup', () => {
    it('When called / Then sends DELETE for that group', async () => {
      mockFetch.mockReturnValue(jsonOk({ success: true, attributes_ungrouped: 3 }));
      const result = await productTypeService.deleteAttributeGroup('pt1', 'g1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attribute-groups/g1');
      expect(opts.method).toBe('DELETE');
      expect(result.attributes_ungrouped).toBe(3);
    });
  });

  describe('Given updateAttribute with a group', () => {
    it('When an attribute is assigned / Then group_id rides along with sort_order', async () => {
      mockFetch.mockReturnValue(jsonOk({ id: 'attr1', group_id: 'g1' }));
      await productTypeService.updateAttribute('pt1', 'attr1', { group_id: 'g1', sort_order: 2 });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/product-types/org-1/pt1/attributes/attr1');
      expect(JSON.parse(opts.body)).toEqual({ group_id: 'g1', sort_order: 2 });
    });
  });
});
