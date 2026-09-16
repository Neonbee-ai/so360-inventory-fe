import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

vi.mock('../../../components/categories/CategoryPicker', () => ({
  default: ({ categories, value, onChange }: any) => (
    <select data-testid="category-picker" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select category</option>
      {categories.map((c: any) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  ),
}));

import CategoryTab from './CategoryTab';

const sampleCategories = [
  { id: 'cat-1', name: 'Electronics', description: '' },
  { id: 'cat-2', name: 'Clothing', description: '' },
  { id: 'cat-3', name: 'Food & Beverage', description: '' },
];

const makeProps = (overrides: any = {}) => ({
  category_id: '',
  categories: sampleCategories,
  updateField: vi.fn(),
  onQuickAddCategory: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('CategoryTab', () => {
  describe('Given the tab is rendered with a list of categories', () => {
    it('When the tab renders / Then shows the "Item Category" section heading', () => {
      render(<CategoryTab {...makeProps()} />);
      expect(screen.getByText('Item Category *')).toBeInTheDocument();
    });

    it('When the tab renders / Then the CategoryPicker component is present', () => {
      render(<CategoryTab {...makeProps()} />);
      expect(screen.getByTestId('category-picker')).toBeInTheDocument();
    });

    it('When the tab renders / Then all available categories are shown in the picker', () => {
      render(<CategoryTab {...makeProps()} />);
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
      expect(screen.getByText('Food & Beverage')).toBeInTheDocument();
    });
  });

  describe('Given no category has been selected yet', () => {
    it('When category_id is empty / Then the selection display badge is not shown', () => {
      render(<CategoryTab {...makeProps({ category_id: '' })} />);
      expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();
    });
  });

  describe('Given the user selects a category', () => {
    it('When a category is chosen from the picker / Then calls updateField with "category_id" and the chosen id', () => {
      const updateField = vi.fn();
      render(<CategoryTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByTestId('category-picker'), { target: { value: 'cat-1' } });
      expect(updateField).toHaveBeenCalledWith('category_id', 'cat-1');
    });

    it('When a different category is selected / Then calls updateField with the new id', () => {
      const updateField = vi.fn();
      render(<CategoryTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByTestId('category-picker'), { target: { value: 'cat-2' } });
      expect(updateField).toHaveBeenCalledWith('category_id', 'cat-2');
    });
  });

  describe('Given a category is already selected', () => {
    it('When category_id matches a known category / Then shows the selected category name in the display badge', () => {
      render(<CategoryTab {...makeProps({ category_id: 'cat-1' })} />);
      expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
    });

    it('When category_id matches "cat-2" / Then shows Clothing in the display badge', () => {
      render(<CategoryTab {...makeProps({ category_id: 'cat-2' })} />);
      expect(screen.getAllByText('Clothing').length).toBeGreaterThan(0);
    });

    it('When category_id does not match any category / Then shows "Unknown" in the display badge', () => {
      render(<CategoryTab {...makeProps({ category_id: 'nonexistent-id' })} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Given an empty category list', () => {
    it('When no categories are provided / Then picker renders without crashing', () => {
      expect(() => render(<CategoryTab {...makeProps({ categories: [] })} />)).not.toThrow();
    });
  });

  describe('Given dynamic attribute definitions for the selected category', () => {
    const defOf = (overrides: any = {}) => ({
      id: 'def-1',
      org_id: 'org-1',
      tenant_id: 'ten-1',
      category_id: 'cat-1',
      attribute_key: 'attr',
      attribute_label: 'Attr',
      attribute_type: 'text',
      options: null,
      unit: null,
      is_required: false,
      sort_order: 0,
      ...overrides,
    });

    it('When a currency attribute is defined / Then a numeric input is rendered and edits propagate as a number', () => {
      const updateField = vi.fn();
      render(<CategoryTab {...makeProps({ category_id: 'cat-1', updateField, attributeDefs: [defOf({ attribute_type: 'currency', attribute_key: 'price', attribute_label: 'List Price', unit: 'AED' })] })} />);
      const input = screen.getByPlaceholderText('List Price');
      fireEvent.change(input, { target: { value: '12.50' } });
      expect(updateField).toHaveBeenCalledWith('metadata', { price: 12.5 });
    });

    it('When a date attribute is defined / Then a date input is rendered and edits propagate the string value', () => {
      const updateField = vi.fn();
      const { container } = render(<CategoryTab {...makeProps({ category_id: 'cat-1', updateField, attributeDefs: [defOf({ attribute_type: 'date', attribute_key: 'mfg_date', attribute_label: 'Mfg Date' })] })} />);
      const input = container.querySelector('input[type="date"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.change(input, { target: { value: '2026-06-01' } });
      expect(updateField).toHaveBeenCalledWith('metadata', { mfg_date: '2026-06-01' });
    });

    it('When a textarea attribute is defined / Then a textarea is rendered and edits propagate', () => {
      const updateField = vi.fn();
      render(<CategoryTab {...makeProps({ category_id: 'cat-1', updateField, attributeDefs: [defOf({ attribute_type: 'textarea', attribute_key: 'remarks', attribute_label: 'Remarks' })] })} />);
      const input = screen.getByPlaceholderText('Remarks');
      expect(input.tagName).toBe('TEXTAREA');
      fireEvent.change(input, { target: { value: 'note' } });
      expect(updateField).toHaveBeenCalledWith('metadata', { remarks: 'note' });
    });

    it('When a radio attribute is defined / Then one option per choice is rendered and selecting propagates the value', () => {
      const updateField = vi.fn();
      render(<CategoryTab {...makeProps({ category_id: 'cat-1', updateField, attributeDefs: [defOf({ attribute_type: 'radio', attribute_key: 'grade', attribute_label: 'Grade', options: [{ value: 'a', label: 'Grade A' }, { value: 'b', label: 'Grade B' }] })] })} />);
      expect(screen.getByText('Grade A')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Grade B'));
      expect(updateField).toHaveBeenCalledWith('metadata', { grade: 'b' });
    });

    it('When a file attribute is defined / Then a URL input is rendered and edits propagate', () => {
      const updateField = vi.fn();
      render(<CategoryTab {...makeProps({ category_id: 'cat-1', updateField, attributeDefs: [defOf({ attribute_type: 'file', attribute_key: 'spec_sheet', attribute_label: 'Spec Sheet' })] })} />);
      const input = screen.getByPlaceholderText('File URL');
      fireEvent.change(input, { target: { value: 'https://x/y.pdf' } });
      expect(updateField).toHaveBeenCalledWith('metadata', { spec_sheet: 'https://x/y.pdf' });
    });

    // Pulse 3aafa377 — "Prevent Negative Values in Max Weight Capacity Attribute"
    describe('Given a numeric attribute definition has a min_value of 0 configured', () => {
      const weightDef = defOf({
        attribute_type: 'number',
        attribute_key: 'max_weight_capacity',
        attribute_label: 'Max Weight Capacity',
        unit: 'kg',
        min_value: 0,
        max_value: null,
      });

      it('When a negative value is entered / Then an inline error is shown', () => {
        render(
          <CategoryTab
            {...makeProps({
              category_id: 'cat-1',
              attributeDefs: [weightDef],
              metadata: { max_weight_capacity: -12 },
            })}
          />,
        );
        expect(screen.getByTestId('error-attr-max_weight_capacity')).toHaveTextContent(
          'Max Weight Capacity must be greater than 0.',
        );
      });

      it('When a valid positive value is entered / Then no inline error is shown', () => {
        render(
          <CategoryTab
            {...makeProps({
              category_id: 'cat-1',
              attributeDefs: [weightDef],
              metadata: { max_weight_capacity: 12 },
            })}
          />,
        );
        expect(screen.queryByTestId('error-attr-max_weight_capacity')).not.toBeInTheDocument();
      });

      it('When the input is rendered / Then the HTML min attribute mirrors min_value', () => {
        render(
          <CategoryTab
            {...makeProps({
              category_id: 'cat-1',
              attributeDefs: [weightDef],
              metadata: { max_weight_capacity: 12 },
            })}
          />,
        );
        const input = screen.getByPlaceholderText('Max Weight Capacity') as HTMLInputElement;
        expect(input.min).toBe('0');
      });
    });

    describe('Given a numeric attribute definition has no min_value or max_value configured', () => {
      it('When any value including a negative one is entered / Then no inline error is shown (regression — unbounded attributes stay unbounded)', () => {
        const unboundedDef = defOf({
          attribute_type: 'number',
          attribute_key: 'shelf_count',
          attribute_label: 'Shelf Count',
          min_value: null,
          max_value: null,
        });
        render(
          <CategoryTab
            {...makeProps({
              category_id: 'cat-1',
              attributeDefs: [unboundedDef],
              metadata: { shelf_count: -50 },
            })}
          />,
        );
        expect(screen.queryByTestId('error-attr-shelf_count')).not.toBeInTheDocument();
      });
    });

    describe('Given a currency attribute definition has a max_value configured', () => {
      it('When a value above the max is entered / Then an inline error is shown', () => {
        const priceDef = defOf({
          attribute_type: 'currency',
          attribute_key: 'trade_in_value',
          attribute_label: 'Trade-in Value',
          min_value: null,
          max_value: 1000,
        });
        render(
          <CategoryTab
            {...makeProps({
              category_id: 'cat-1',
              attributeDefs: [priceDef],
              metadata: { trade_in_value: 1500 },
            })}
          />,
        );
        expect(screen.getByTestId('error-attr-trade_in_value')).toHaveTextContent(
          'Trade-in Value must be less than 1000.',
        );
      });
    });
  });
});
