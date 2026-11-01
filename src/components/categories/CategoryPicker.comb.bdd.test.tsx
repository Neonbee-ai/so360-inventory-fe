import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../constants/categoryIcons', () => ({
  renderCategoryIcon: vi.fn().mockReturnValue(null),
}));
vi.mock('../../utils/categoryTree', () => ({
  buildCategoryTree: vi.fn().mockImplementation((cats: any[]) => cats.map(c => ({ ...c, children: [], depth: 0 }))),
  flattenTree: vi.fn().mockImplementation((tree: any[]) => tree),
}));

import CategoryPicker from './CategoryPicker';

const cats = [
  { id: 'cat-1', name: 'Electronics', description: '', parent_id: null },
  { id: 'cat-2', name: 'Clothing', description: '', parent_id: null },
];

describe('CategoryPicker (Comb)', () => {
  it('Given no value, When rendered, Then the placeholder shows', () => {
    render(<CategoryPicker categories={cats as any} value="" onChange={vi.fn()} />);
    expect(screen.getByText('Select category...')).toBeInTheDocument();
  });

  it('Given an open dropdown, When a category is clicked, Then onChange receives its id', () => {
    const onChange = vi.fn();
    render(<CategoryPicker categories={cats as any} value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Select category...'));
    fireEvent.click(screen.getByText('Clothing'));
    expect(onChange).toHaveBeenCalledWith('cat-2');
  });

  it('Given a selected value, When None is clicked, Then onChange receives an empty string', () => {
    const onChange = vi.fn();
    render(<CategoryPicker categories={cats as any} value="cat-1" onChange={onChange} />);
    fireEvent.click(screen.getByText('Electronics'));
    fireEvent.click(screen.getByText('None'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
