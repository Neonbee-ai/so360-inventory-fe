import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));
vi.mock('../../../components/attributes/ProductTypePicker', () => ({
  default: () => <div data-testid="product-type-picker" />,
}));

import BasicInfoTab from './BasicInfoTab';

const props: any = {
  name: 'Widget', sku: 'W-1', type: 'product', brand: '', product_type_id: '', barcode: '', description: '',
  unit_id: '', uoms: [], showNewUom: false, newUomName: '', newUomAbbr: '', isCreatingUom: false,
  updateField: vi.fn(), setShowNewUom: vi.fn(), setNewUomName: vi.fn(), setNewUomAbbr: vi.fn(), onCreateUom: vi.fn(),
  isSkuAutoEnabled: true, isSkuManuallyEdited: true, onResetSku: vi.fn(),
};

describe('BasicInfoTab phone width', () => {
  describe('Given SKU badge and Re-generate button share a row', () => {
    it('When rendered / Then the row wraps so it cannot overflow a phone viewport', () => {
      render(<BasicInfoTab {...props} />);
      const row = screen.getByTestId('sku-autogen-badge').parentElement!;
      expect(row.className).toContain('flex-wrap');
      expect(row.parentElement!.className).toContain('min-w-0');
    });
  });
});
