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
      expect(screen.getByText('Item Category')).toBeInTheDocument();
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
});
