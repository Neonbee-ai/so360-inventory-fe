import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../../services/inventoryService', () => ({ inventoryService: { searchHsnSac: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

import PricingTab from './PricingTab';

const makeProps = (overrides: any = {}) => ({
  price: '99.99',
  cost: '50.00',
  tax_class: '',
  tax_code_id: '',
  hsn_code: '',
  updateField: vi.fn(),
  currencySymbol: '$',
  taxCodes: [],
  isTaxCodesLoading: false,
  taxCodesError: null,
  ...overrides,
});

describe('PricingTab', () => {
  describe('Given tab renders', () => {
    it('When rendered / Then shows Pricing section', () => {
      render(<PricingTab {...makeProps()} />);
      expect(screen.getByText('Pricing')).toBeInTheDocument();
    });

    it('When rendered / Then shows selling price input with value', () => {
      render(<PricingTab {...makeProps()} />);
      expect(screen.getByDisplayValue('99.99')).toBeInTheDocument();
    });

    it('When rendered / Then shows cost price input', () => {
      render(<PricingTab {...makeProps()} />);
      expect(screen.getByDisplayValue('50.00')).toBeInTheDocument();
    });

    it('When rendered with currency symbol / Then shows currency in label', () => {
      render(<PricingTab {...makeProps({ currencySymbol: '£' })} />);
      expect(screen.getByText(/Selling Price \(£\)/i)).toBeInTheDocument();
    });
  });

  describe('Given tax codes loading', () => {
    it('When isTaxCodesLoading is true / Then shows loading state', () => {
      render(<PricingTab {...makeProps({ isTaxCodesLoading: true })} />);
      // Loading state in tax codes area
      expect(screen.getByText(/Loading tax codes/i)).toBeInTheDocument();
    });

    it('When taxCodesError exists / Then shows error', () => {
      render(<PricingTab {...makeProps({ taxCodesError: 'Failed to load tax codes' })} />);
      expect(screen.getByText(/Failed to load tax codes/i)).toBeInTheDocument();
    });

    it('When taxCodes present / Then shows tax code option in dropdown', () => {
      const taxCodes = [{ id: 'tc-1', name: 'GST 10%', rate: 10 }];
      render(<PricingTab {...makeProps({ taxCodes })} />);
      // Tax code renders as "GST 10% — 10%"
      expect(screen.getByText(/GST 10%/)).toBeInTheDocument();
    });
  });

  describe('Given user interaction', () => {
    it('When price changes / Then calls updateField', () => {
      const updateField = vi.fn();
      render(<PricingTab {...makeProps({ updateField })} />);
      const priceInput = screen.getByDisplayValue('99.99');
      fireEvent.change(priceInput, { target: { value: '129.99' } });
      expect(updateField).toHaveBeenCalledWith('price', '129.99');
    });
  });

  describe('Given an invalid HSN / SAC code', () => {
    it('When the tab is told of the error / Then it shows beside the field', () => {
      render(<PricingTab {...makeProps({ hsn_code: '85', hsnError: 'HSN / SAC must be 4, 6 or 8 digits.' })} />);
      expect(screen.getByText('HSN / SAC must be 4, 6 or 8 digits.')).toBeInTheDocument();
    });
    it('When there is no error / Then no message is shown', () => {
      render(<PricingTab {...makeProps({ hsn_code: '8517' })} />);
      expect(screen.queryByText(/must be 4, 6 or 8/)).not.toBeInTheDocument();
    });
  });
});

describe('PricingTab — HSN/SAC master (flag)', () => {
  it('Given the flag is off / Then the HSN field is plain text and there is no goods/service select', () => {
    render(<PricingTab {...makeProps({ hsnSacMaster: false, hsn_code: '8471' })} />);
    expect(screen.getByDisplayValue('8471')).toBeInTheDocument();
    expect(screen.queryByLabelText('Goods or service')).toBeNull();
  });
  it('Given the flag is on / Then the goods/service select and the searchable picker show', () => {
    render(<PricingTab {...makeProps({ hsnSacMaster: true, hsn_sac_kind: 'service', itemType: 'product' })} />);
    expect(screen.getByLabelText('Goods or service')).toBeInTheDocument();
    expect(screen.getByLabelText('SAC Code')).toBeInTheDocument();
  });
  it('Given the flag is on / When the kind changes / Then updateField is called', () => {
    const updateField = vi.fn();
    render(<PricingTab {...makeProps({ hsnSacMaster: true, updateField })} />);
    fireEvent.change(screen.getByLabelText('Goods or service'), { target: { value: 'goods' } });
    expect(updateField).toHaveBeenCalledWith('hsn_sac_kind', 'goods');
  });
});
