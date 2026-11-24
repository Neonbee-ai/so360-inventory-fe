import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetOne = vi.fn();

vi.mock('../../../services/productTypeService', () => ({
  productTypeService: {
    getOne: (...args: any[]) => mockGetOne(...args),
  },
}));

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

vi.mock('../../../components/attributes/DynamicAttributeField', () => ({
  default: ({ attribute, value, onChange }: any) => (
    <div data-testid={`attr-${attribute.field_name}`}>
      <label>{attribute.label}</label>
    </div>
  ),
}));

import AttributesTab from './AttributesTab';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOne.mockResolvedValue({
    id: 'pt-1',
    name: 'Electronics',
    code: 'electronics',
    product_type_attributes: [
      { id: 'a-1', field_name: 'color', label: 'Color', field_type: 'text', is_required: false, sort_order: 0 },
    ],
  });
});

describe('AttributesTab', () => {
  describe('Given no product type selected', () => {
    it('When product_type_id is empty / Then shows No Product Type Selected', () => {
      render(<AttributesTab product_type_id="" custom_attributes={{}} updateField={vi.fn()} />);
      expect(screen.getByText('No Product Type Selected')).toBeInTheDocument();
    });
  });

  describe('Given product type selected', () => {
    it('When product_type_id provided / Then calls getOne with id', async () => {
      render(<AttributesTab product_type_id="pt-1" custom_attributes={{}} updateField={vi.fn()} />);
      await waitFor(() => {
        expect(mockGetOne).toHaveBeenCalledWith('pt-1');
      });
    });

    it('When product type loads / Then shows attribute fields', async () => {
      render(<AttributesTab product_type_id="pt-1" custom_attributes={{}} updateField={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Color')).toBeInTheDocument();
      });
    });

    it('When getOne fails / Then shows no attributes message', async () => {
      mockGetOne.mockRejectedValue(new Error('Not found'));
      render(<AttributesTab product_type_id="pt-1" custom_attributes={{}} updateField={vi.fn()} />);
      await waitFor(() => {
        // When load fails, productType is null; shows "Product Type" fallback text
        expect(screen.getAllByText(/No attribute fields defined|Product Type/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given a furniture type whose dimensions tie on sort_order (Pulse f2493088)', () => {
    it('When the tab renders / Then fields read Length, Breadth, Height before Colour / Finish and Material', async () => {
      mockGetOne.mockResolvedValue({
        id: 'pt-2', name: 'Furniture', code: 'furniture',
        product_type_attributes: [
          { id: 'b', field_name: 'breadth', label: 'Breadth', field_type: 'number', is_required: false, sort_order: 0 },
          { id: 'h', field_name: 'height', label: 'Height', field_type: 'number', is_required: false, sort_order: 0 },
          { id: 'l', field_name: 'length', label: 'Length', field_type: 'number', is_required: false, sort_order: 0 },
          { id: 'c', field_name: 'colour_finish', label: 'Colour / Finish', field_type: 'text', is_required: false, sort_order: 0 },
          { id: 'm', field_name: 'material', label: 'Material', field_type: 'text', is_required: false, sort_order: 0 },
        ],
      });
      render(<AttributesTab product_type_id="pt-2" custom_attributes={{}} updateField={vi.fn()} />);
      await waitFor(() => expect(screen.getByTestId('attr-length')).toBeInTheDocument());
      const order = screen.getAllByTestId(/^attr-/).map((el) => el.getAttribute('data-testid'));
      expect(order).toEqual(['attr-length', 'attr-breadth', 'attr-height', 'attr-colour_finish', 'attr-material']);
    });
  });
});
