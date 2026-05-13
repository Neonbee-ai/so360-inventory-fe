import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../constants/categoryIcons', () => ({
  renderCategoryIcon: vi.fn().mockReturnValue(null),
}));

vi.mock('../../utils/categoryTree', () => ({
  buildCategoryTree: vi.fn().mockImplementation((cats: any[]) => cats.map(c => ({ ...c, children: [], depth: 0 }))),
  flattenTree: vi.fn().mockImplementation((tree: any[]) => tree),
}));

import CategoryPicker from './CategoryPicker';

const makeCategories = () => [
  { id: 'cat-1', name: 'Electronics', description: '', parent_id: null },
  { id: 'cat-2', name: 'Clothing', description: '', parent_id: null },
];

describe('CategoryPicker', () => {
  describe('Given initial state', () => {
    it('When rendered / Then shows select category placeholder', () => {
      render(<CategoryPicker categories={makeCategories()} value="" onChange={vi.fn()} />);
      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('When value is selected / Then shows selected category path', () => {
      render(<CategoryPicker categories={makeCategories()} value="cat-1" onChange={vi.fn()} />);
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });
  });

  describe('Given dropdown interaction', () => {
    it('When button clicked / Then shows dropdown with categories', () => {
      render(<CategoryPicker categories={makeCategories()} value="" onChange={vi.fn()} />);
      fireEvent.click(screen.getByText('Select category...'));
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
    });

    it('When category selected / Then calls onChange with category id', () => {
      const onChange = vi.fn();
      render(<CategoryPicker categories={makeCategories()} value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Select category...'));
      fireEvent.click(screen.getByText('Electronics'));
      expect(onChange).toHaveBeenCalledWith('cat-1');
    });

    it('When None clicked / Then calls onChange with empty string', () => {
      const onChange = vi.fn();
      render(<CategoryPicker categories={makeCategories()} value="cat-1" onChange={onChange} />);
      fireEvent.click(screen.getByText('Electronics'));
      // None button should appear in the dropdown
      fireEvent.click(screen.getByText('None'));
      expect(onChange).toHaveBeenCalledWith('');
    });

    it('When search typed / Then filters categories', () => {
      render(<CategoryPicker categories={makeCategories()} value="" onChange={vi.fn()} />);
      fireEvent.click(screen.getByText('Select category...'));
      fireEvent.change(screen.getByPlaceholderText('Search categories...'), { target: { value: 'Elec' } });
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });
  });
});
