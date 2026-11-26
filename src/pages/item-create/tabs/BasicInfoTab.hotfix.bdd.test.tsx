import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import BasicInfoTab from './BasicInfoTab';

vi.mock('../../../components/attributes/ProductTypePicker', () => ({ default: () => null }));

const base: any = {
  name: '', sku: '', type: 'product', brand: '', barcode: '', description: '', unit_id: '', uoms: [],
  product_type_id: null, showNewUom: false, newUomName: '', newUomAbbr: '', isCreatingUom: false,
  updateField: vi.fn(), setShowNewUom: vi.fn(), setNewUomName: vi.fn(), setNewUomAbbr: vi.fn(), onCreateUom: vi.fn(),
};

describe('BasicInfoTab (Pulse 06c0f42a, edc59c59)', () => {
  it('given type=product, when rendered, then only that card is selected, rounded and checked', () => {
    render(<BasicInfoTab {...base} />);
    const selected = document.querySelectorAll('button[data-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].className).toContain('rounded-nb-lg');
    expect(selected[0].className).not.toContain('rounded-nb-md');
    expect(screen.getAllByTestId('classification-check')).toHaveLength(1);
  });

  it('given SKU auto-generation, when rendered, then the badge follows the SKU input so the label row is not shifted', () => {
    render(<BasicInfoTab {...base} isSkuAutoEnabled />);
    const input = document.querySelector('input[name="sku"]') as HTMLElement;
    const badge = screen.getByTestId('sku-autogen-badge');
    expect(input.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
