import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

vi.mock('../../../components/attributes/ProductTypePicker', () => ({
  default: (props: any) => <div data-testid="product-type-picker">ProductTypePicker</div>,
}));

import BasicInfoTab from './BasicInfoTab';

const makeProps = (overrides: any = {}) => ({
  name: 'Widget Pro',
  sku: 'WGT-001',
  type: 'product' as any,
  brand: 'WidgetCo',
  product_type_id: '',
  barcode: '',
  description: 'A great widget',
  unit_id: 'uom-1',
  uoms: [{ id: 'uom-1', name: 'Piece', abbreviation: 'PCS' }],
  showNewUom: false,
  newUomName: '',
  newUomAbbr: '',
  isCreatingUom: false,
  updateField: vi.fn(),
  setShowNewUom: vi.fn(),
  setNewUomName: vi.fn(),
  setNewUomAbbr: vi.fn(),
  onCreateUom: vi.fn(),
  ...overrides,
});

describe('BasicInfoTab', () => {
  describe('Given tab renders', () => {
    it('When rendered / Then shows Identification section', () => {
      render(<BasicInfoTab {...makeProps()} />);
      expect(screen.getByText('Identification')).toBeInTheDocument();
    });

    it('When rendered / Then shows item name input with value', () => {
      render(<BasicInfoTab {...makeProps()} />);
      const nameInput = screen.getByDisplayValue('Widget Pro');
      expect(nameInput).toBeInTheDocument();
    });

    it('When rendered / Then shows SKU input', () => {
      render(<BasicInfoTab {...makeProps()} />);
      expect(screen.getByDisplayValue('WGT-001')).toBeInTheDocument();
    });

    it('When rendered / Then shows description textarea', () => {
      render(<BasicInfoTab {...makeProps()} />);
      expect(screen.getByDisplayValue('A great widget')).toBeInTheDocument();
    });

    it('When rendered / Then shows Unit of Measure dropdown', () => {
      render(<BasicInfoTab {...makeProps()} />);
      // UOM renders as "Piece (PCS)"
      expect(screen.getByText('Piece (PCS)')).toBeInTheDocument();
    });
  });

  describe('Given user interaction', () => {
    it('When name input changes / Then calls updateField with name', () => {
      const updateField = vi.fn();
      render(<BasicInfoTab {...makeProps({ updateField })} />);
      const nameInput = screen.getByDisplayValue('Widget Pro');
      fireEvent.change(nameInput, { target: { value: 'New Widget' } });
      expect(updateField).toHaveBeenCalledWith('name', 'New Widget');
    });

    it('When SKU input changes / Then calls updateField with sku', () => {
      const updateField = vi.fn();
      render(<BasicInfoTab {...makeProps({ updateField })} />);
      const skuInput = screen.getByDisplayValue('WGT-001');
      fireEvent.change(skuInput, { target: { value: 'NEW-001' } });
      expect(updateField).toHaveBeenCalledWith('sku', 'NEW-001');
    });
  });

  describe('Given Add UoM flow', () => {
    it('When showNewUom is false / Then does not show new UoM inputs', () => {
      render(<BasicInfoTab {...makeProps({ showNewUom: false })} />);
      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument();
    });

    it('When showNewUom is true / Then shows new UoM name and abbr inputs', () => {
      render(<BasicInfoTab {...makeProps({ showNewUom: true })} />);
      expect(screen.getByPlaceholderText('Unit name *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Abbreviation * (e.g. pcs, kg)')).toBeInTheDocument();
    });
  });
});
